import HealthButton from './HealthButton';

// async function getHealth() {
//   console.log("Fetching health from API...", process.env.API_BASE_URL);
//   const res = await fetch(`${process.env.API_BASE_URL}/health`, {
//     cache: "no-store", // always fresh
//   });
//   if(!res.ok) {
//     throw new Error("API unreachable");
//   }
//   return res.json();
// }

export default async function Home() {
  // const health = await getHealth();
  return (
    <main className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-3xl font-bold p-4">Task Manager</h1>
      {/* <p className="text-md">API says: <strong>{health.message}</strong></p>
      <p className="text-md">API Health: {health.status} - {health.time}</p> */}

      <HealthButton apiUrl={process.env.API_BASE_URL || ""} />
    </main>
  );
}