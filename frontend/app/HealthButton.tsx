"use client";

export default function HealthButton({ apiUrl }: { apiUrl: string }) {
  return (
    <button 
      onClick={async () => {
        try {
          const res = await fetch(`${apiUrl}/health`, {
            cache: "no-store",
          });
          if(!res.ok) {
            throw new Error("API unreachable");
          }
          const data = await res.json();
          alert(`API says: ${data.message}`);
        } catch (error: any) {
          alert(`Error: ${error.message}`);
        }
      }} 
      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Check API Health
    </button>
  );
}