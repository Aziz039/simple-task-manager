// app/todos/page.tsx  (Server Component — fetches the list)
import NewTodo from "./new-todo";

async function getTodos() {
  const res = await fetch(`${process.env.API_BASE_URL}/api/todos`, { cache: "no-store" });
  return res.json();
}

export default async function TodosPage() {
  const todos = await getTodos();
  return (
    <main style={{ padding: 32 }}>
      <h1>My Todos</h1>
      <NewTodo />
      <ul>
        {todos.map((t: any) => (
          <li key={t.id}>{t.isDone ? "✅" : "⬜"} {t.title}</li>
        ))}
      </ul>
    </main>
  );
}