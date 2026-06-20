"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewTodo() {
  const [title, setTitle] = useState("");
  const router = useRouter();

  async function addTodo() {
    try {
        console.log("Adding new todo:", title);
        console.log("url:", process.env.NEXT_PUBLIC_API_BASE_URL);
        await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/todos`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ title }),
        });
        setTitle("");
        router.refresh();
    } catch (error) {
        console.error("Error adding todo:", error);
    }
  }

  return (
    <div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Enter new todo"
      />
      <button onClick={addTodo}>Add Todo</button>
    </div>
  );
}