import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { Todo } from "../utils/todo";
import { scheduleTodoNotification, cancelTodoNotification } from "../utils/notifications";

type TodoContextValue = {
  todos: Todo[];
  addTodo: (t: Omit<Todo, "id" | "notifId">) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
  removeTodo: (id: string) => Promise<void>;
  getByDate: (date: string) => Todo[];
};

const TodoContext = createContext<TodoContextValue | undefined>(undefined);
const STORAGE_KEY = "@app/todos";

export const TodoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    (async () => {
      try { const raw = await AsyncStorage.getItem(STORAGE_KEY); if (raw) setTodos(JSON.parse(raw)); } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(todos)).catch(() => {
      Alert.alert("Erreur", "Impossible d'enregistrer vos tâches.");
    });
  }, [todos]);

  const addTodo: TodoContextValue["addTodo"] = async (t) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let notifId: string | undefined;

    if (t.date && t.time) {
      notifId = await scheduleTodoNotification({ id, dateISO: t.date, time: t.time, title: t.title }) ?? undefined;
    }
    setTodos((prev) => [{ id, notifId, ...t }, ...prev]);
  };

  const toggleTodo: TodoContextValue["toggleTodo"] = async (id) => {
    setTodos((prev) => {
      const x = prev.find((t) => t.id === id);
      if (!x) return prev;
      const nextDone = !x.done;
      return prev.map((t) => (t.id === id ? { ...t, done: nextDone } : t));
    });

    const current = todos.find((t) => t.id === id);
    if (!current) return;

    if (!current.done) {
      // on passe à "fait" => annule
      if (current.notifId) {
        await cancelTodoNotification(current.notifId);
        setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, notifId: undefined } : t)));
      }
    } else {
      // on redevient "à faire" => replanifie si future
      if (current.date && current.time) {
        const newId = await scheduleTodoNotification({ id, dateISO: current.date, time: current.time, title: current.title });
        if (newId) setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, notifId: newId } : t)));
      }
    }
  };

  const removeTodo: TodoContextValue["removeTodo"] = async (id) => {
    const t = todos.find((x) => x.id === id);
    if (t?.notifId) await cancelTodoNotification(t.notifId);
    setTodos((prev) => prev.filter((x) => x.id !== id));
  };

  const getByDate = (date: string) => {
    const arr = todos.filter((t) => t.date === date);
    // tri: heure définie d’abord (croissant), puis sans heure
    return arr.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  };

  const value = useMemo(() => ({ todos, addTodo, toggleTodo, removeTodo, getByDate }), [todos]);
  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
};

export const useTodos = () => {
  const ctx = useContext(TodoContext);
  if (!ctx) throw new Error("useTodos must be used within TodoProvider");
  return ctx;
};
