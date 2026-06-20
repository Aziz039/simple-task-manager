# TaskManager: One-Day Senior Build Plan (.NET 10 + Next.js 16 + Postgres)

A vertical-slice learning plan. You build a tiny piece end-to-end, run it, understand *why*, then add the next slice. We never build "the whole backend" before touching the frontend — the moment an API works, we wire the UI to it. That habit is what separates seniors from tutorial-followers: you always have something running, and integration bugs surface immediately instead of on day 5.

**Stack (current as of 2026):** .NET 10 (LTS) Web API · EF Core 10 + Npgsql · PostgreSQL · Redis · Next.js 16 (App Router, React Server Components) · React 19.

---

## How to use this document

Each phase has the same shape:

- **Goal** — the one runnable thing you'll have at the end.
- **Why / end goal** — where this fits in the final architecture.
- **Tasks** — copy-pasteable, ordered steps.
- **Run & verify** — how you prove it works before moving on.
- **Concept deep-dive** — the senior-level "why it works this way."
- **Checkpoint** — don't proceed until this is true.

Work top to bottom. Don't skip "Run & verify" — a green checkpoint is the whole point of vertical slices.

---

## The end goal: what you'll have built

A multi-user to-do app where:

1. Users register and log in (real auth, not a fake `userId` in the URL).
2. Each user has private to-do items (create, list, complete, delete).
3. Items can have **file attachments** (images, PDFs).
4. The list is **cached** so repeat loads don't hit the database.
5. The frontend is a Next.js app that renders on the server, talks to the API, and protects routes.

Then a clear runway to scale it into "something more powerful" (the last section).

---

## The final architecture

```
                                  ┌─────────────────────────────┐
        Browser                   │   CDN  (static + attachments)│
           │                      └──────────────┬──────────────┘
           │  HTTPS                               │ signed URLs
           ▼                                      │
┌──────────────────────┐   fetch / cookies   ┌────┴───────────────────────┐
│   Next.js 16 (App     │ ──────────────────► │   ASP.NET Core 10 Web API   │
│   Router, RSC)        │ ◄────────────────── │                            │
│   - Server Components  │      JSON/DTOs      │   Middleware pipeline:      │
│   - Server Actions     │                     │   CORS → Auth → Routing →   │
│   - route protection   │                     │   Endpoints                 │
└──────────────────────┘                     │                            │
                                              │   Layers:                   │
                                              │   Endpoints → Services →    │
                                              │   EF Core (DbContext)       │
                                              └──┬───────────┬──────────┬───┘
                                                 │           │          │
                                       ┌─────────▼──┐  ┌─────▼────┐ ┌───▼─────────┐
                                       │ PostgreSQL │  │  Redis   │ │ Blob store  │
                                       │ (EF Core / │  │ (cache)  │ │ (S3 / Azure │
                                       │  Npgsql)   │  │          │ │  Blob)      │
                                       └────────────┘  └──────────┘ └─────────────┘
```

**Why each box exists:**

- **Next.js (App Router + RSC)** — renders pages on the server (fast first paint, good SEO, secrets stay server-side), and only ships JS for interactive bits.
- **ASP.NET Core Web API** — the source of truth for business rules and data. The frontend never talks to the database directly.
- **PostgreSQL via EF Core** — your relational store; EF Core is the ORM that maps C# objects to tables so you write LINQ instead of raw SQL (most of the time).
- **Redis** — an in-memory cache so hot reads (the to-do list) skip Postgres.
- **Blob store + CDN** — files don't belong in a relational DB. You store the bytes in object storage and serve them through a CDN (edge-cached, close to the user).

---

## The senior concepts you'll actually master today

Tick these off as you go — each maps to a phase:

- [ ] Request pipeline & middleware ordering (Phase 1)
- [ ] CORS and the browser security model (Phase 2)
- [ ] ORM, code-first migrations, DbContext lifetime, connection pooling (Phase 3)
- [ ] DTOs vs entities, why you never expose your DB model (Phase 4)
- [ ] Validation at the boundary (Phase 4)
- [ ] Authentication vs authorization; cookies vs JWT; httpOnly (Phase 5)
- [ ] Data ownership / row-level scoping by user (Phase 5)
- [ ] Eager vs lazy loading, the N+1 problem (Phase 6)
- [ ] Object storage + presigned URLs + CDN (Phase 6)
- [ ] Cache-aside pattern & cache invalidation (Phase 7)
- [ ] Pagination, indexes, observability (Phase 8)

---

## Phase 0 — Setup & mental model (30 min)

**Goal:** tools installed, you can explain the architecture diagram out loud.

**Tasks:**

1. Install the **.NET 10 SDK**: https://dotnet.microsoft.com/download — verify:
   ```bash
   dotnet --version    # should print 10.0.x
   ```
2. Install **Node.js 20+** (Next.js 16 needs ≥18.18, use 20 LTS or newer):
   ```bash
   node --version
   ```
3. Install **PostgreSQL** and **Redis**. Fastest path is Docker so you don't pollute your machine:
   ```bash
   # docker-compose.yml in a new folder `taskmanager/`
   ```
   ```yaml
   services:
     db:
       image: postgres:17
       environment:
         POSTGRES_PASSWORD: devpass
         POSTGRES_DB: taskmanager
       ports: ["5432:5432"]
       volumes: ["pgdata:/var/lib/postgresql/data"]
     cache:
       image: redis:7
       ports: ["6379:6379"]
   volumes:
     pgdata:
   ```
   ```bash
   docker compose up -d
   ```
4. Pick an editor: VS Code (+ C# Dev Kit extension) or JetBrains Rider.

**Concept deep-dive — why Docker for infra:** running Postgres and Redis as containers means your environment is reproducible and disposable. Seniors treat infrastructure as code; a `docker-compose.yml` checked into the repo means a new teammate is running in one command. You're also matching dev to prod (same Postgres major version), which kills "works on my machine" bugs.

**Checkpoint:** `docker compose ps` shows `db` and `cache` healthy.

---

## Phase 1 — Backend "Hello World" API (40 min)

**Goal:** a running .NET API with a `/health` endpoint returning JSON.

**Why / end goal:** this is the spine everything attaches to. Before databases or auth, prove the web server boots and serves a response. You'll learn the request pipeline here — the thing every later feature (CORS, auth, caching) plugs into.

**Tasks:**

1. Create the API project (minimal API template):
   ```bash
   cd taskmanager
   dotnet new web -n TaskManager.Api
   cd TaskManager.Api
   ```
2. Replace `Program.cs` with:
   ```csharp
   var builder = WebApplication.CreateBuilder(args);
   var app = builder.Build();

   app.MapGet("/health", () => new
   {
       status = "ok",
       message = "Hello World from TaskManager API",
       time = DateTime.UtcNow
   });

   app.Run();
   ```
3. Run it:
   ```bash
   dotnet run
   ```

**Run & verify:** the console prints a URL like `http://localhost:5xxx`. Hit `http://localhost:5xxx/health` in your browser — you should see JSON. (Note the port; you'll need it in Phase 2.)

**Concept deep-dive — the middleware pipeline:** `WebApplication.CreateBuilder` wires up configuration, logging, and dependency injection (DI). `app.Run()` starts **Kestrel**, the cross-platform web server. Every request flows through a **pipeline** of middleware in the order you register it: each piece can inspect/short-circuit the request, then pass it on. Right now the pipeline is basically empty — just routing to your endpoint. In later phases you'll add CORS, authentication, and authorization middleware, and **order matters**: auth must run before the endpoint that needs the logged-in user. Holding this mental model now means Phases 5 and 7 won't feel like magic.

**Checkpoint:** `/health` returns 200 JSON in the browser.

---

## Phase 2 — Frontend "Hello World" + first wire-up (45 min)

**Goal:** a Next.js app whose homepage fetches and displays the API's `/health` response.

**Why / end goal:** **this is the first vertical slice.** It looks trivial, but it forces you to solve CORS and the frontend↔backend contract on day one, when there's nothing else to debug. Every senior has been burned by leaving integration until the end.

**Tasks:**

1. From `taskmanager/`, create the Next.js app:
   ```bash
   npx create-next-app@latest taskmanager-web
   # choose: TypeScript=Yes, App Router=Yes, Turbopack=Yes, Tailwind=Yes (your call)
   cd taskmanager-web
   ```
2. Add the API base URL to `.env.local`:
   ```bash
   # use YOUR api port from Phase 1
   API_BASE_URL=http://localhost:5xxx
   ```
3. Make the homepage a **Server Component** that fetches from the API. Replace `app/page.tsx`:
   ```tsx
   async function getHealth() {
     const res = await fetch(`${process.env.API_BASE_URL}/health`, {
       cache: "no-store", // always fresh for this demo
     });
     if (!res.ok) throw new Error("API unreachable");
     return res.json();
   }

   export default async function Home() {
     const health = await getHealth();
     return (
       <main style={{ padding: 32, fontFamily: "system-ui" }}>
         <h1>TaskManager</h1>
         <p>API says: <strong>{health.message}</strong></p>
         <p>Status: {health.status} · {health.time}</p>
       </main>
     );
   }
   ```
4. Enable **CORS** on the API so the browser is allowed to call it. In `Program.cs`, before `app.Run()`:
   ```csharp
   // in builder section:
   builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
       p.WithOrigins("http://localhost:3000")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials())); // we'll need credentials for auth later

   // in app section, BEFORE MapGet:
   app.UseCors();
   ```
5. Run both: API (`dotnet run`) in one terminal, web (`npm run dev`) in another.

**Run & verify:** open `http://localhost:3000` — you see "API says: Hello World from TaskManager API." If you see a CORS error in the API terminal or a fetch failure, that's the lesson, not a setback.

**Concept deep-dive — why the fetch worked without CORS errors *this* time, and the nuance:** the homepage is a **React Server Component (RSC)**. It runs on Next's *server*, not in the browser, so that first fetch is server-to-server — CORS (a *browser* security rule) doesn't even apply. You still added CORS because the moment you do an interactive fetch from a Client Component (a button that creates a to-do), the request comes from the browser and the browser enforces the **same-origin policy**: it blocks cross-origin requests unless the server explicitly opts in with CORS headers. Knowing *which* code runs server-side vs browser-side is the single most important Next.js mental model — it decides where your secrets live, where CORS matters, and what ships to the client.

**Checkpoint:** homepage renders live data from the API. Wire is proven end-to-end.

---

## Phase 3 — Postgres + EF Core: your first real entity (90 min)

**Goal:** `GET /api/todos` and `POST /api/todos` backed by a real Postgres table, with the frontend listing and creating todos.

**Why / end goal:** this is the heart of the app and your introduction to the **ORM**. You'll define a C# class, generate a migration, and let EF Core create the table — then read/write through LINQ.

**Tasks:**

1. Add EF Core + the Postgres provider to the API project:
   ```bash
   cd TaskManager.Api
   dotnet add package Microsoft.EntityFrameworkCore.Design
   dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
   dotnet tool install --global dotnet-ef   # the migrations CLI
   ```
2. Create the entity — `Models/TodoItem.cs`:
   ```csharp
   namespace TaskManager.Api.Models;

   public class TodoItem
   {
       public Guid Id { get; set; } = Guid.NewGuid();
       public string Title { get; set; } = "";
       public bool IsDone { get; set; }
       public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
   }
   ```
3. Create the DbContext — `Data/AppDbContext.cs`:
   ```csharp
   using Microsoft.EntityFrameworkCore;
   using TaskManager.Api.Models;

   namespace TaskManager.Api.Data;

   public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
   {
       public DbSet<TodoItem> Todos => Set<TodoItem>();
   }
   ```
4. Register it and add the connection string. In `appsettings.json`:
   ```json
   "ConnectionStrings": {
     "Default": "Host=localhost;Port=5432;Database=taskmanager;Username=postgres;Password=devpass"
   }
   ```
   In `Program.cs` builder section:
   ```csharp
   builder.Services.AddDbContext<AppDbContext>(o =>
       o.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
   ```
5. Generate and apply the first migration:
   ```bash
   dotnet ef migrations add InitialCreate
   dotnet ef database update
   ```
6. Add the endpoints in `Program.cs` (after `app.UseCors()`):
   ```csharp
   app.MapGet("/api/todos", async (AppDbContext db) =>
       await db.Todos.OrderByDescending(t => t.CreatedAt).ToListAsync());

   app.MapPost("/api/todos", async (AppDbContext db, TodoItem input) =>
   {
       var todo = new TodoItem { Title = input.Title };
       db.Todos.Add(todo);
       await db.SaveChangesAsync();
       return Results.Created($"/api/todos/{todo.Id}", todo);
   });
   ```

**Run & verify:** restart the API. `POST` a todo (use the Next UI below, or `curl`):
```bash
curl -X POST http://localhost:5xxx/api/todos -H "Content-Type: application/json" -d '{"title":"Learn EF Core"}'
curl http://localhost:5xxx/api/todos
```

7. **Wire the frontend immediately** (vertical slice). In `taskmanager-web`, create `app/todos/page.tsx` with a server-rendered list and a Client Component form:
   ```tsx
   // app/todos/page.tsx  (Server Component — fetches the list)
   import { NewTodo } from "./new-todo";

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
   ```
   ```tsx
   // app/todos/new-todo.tsx  ("use client" — interactive form)
   "use client";
   import { useState } from "react";
   import { useRouter } from "next/navigation";

   export function NewTodo() {
     const [title, setTitle] = useState("");
     const router = useRouter();
     async function add() {
       await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/todos`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ title }),
       });
       setTitle("");
       router.refresh(); // re-run the Server Component to show the new item
     }
     return (
       <div>
         <input value={title} onChange={e => setTitle(e.target.value)} />
         <button onClick={add}>Add</button>
       </div>
     );
   }
   ```
   Add `NEXT_PUBLIC_API_BASE_URL` to `.env.local` (the `NEXT_PUBLIC_` prefix exposes it to the browser, which the Client Component needs).

**Concept deep-dive (read this twice):**

- **ORM / EF Core:** instead of writing SQL, you describe tables as C# classes. `db.Todos.OrderByDescending(...)` is **LINQ that EF translates to a parameterized SQL query** at runtime. Benefits: type safety, refactoring, and protection from SQL injection (parameters, not string concatenation). Cost: you must understand *what SQL it generates* — a leaky abstraction. Seniors log the generated SQL (`o.LogTo(Console.WriteLine)`) so they're never surprised.
- **Code-first migrations:** `dotnet ef migrations add` diffs your C# model against the last migration and generates a versioned C# file describing the schema change; `database update` runs it. Migrations are checked into git, so the schema evolves with the code and every environment applies the same ordered changes. **Never** edit the database by hand in a real project.
- **DbContext lifetime:** `AddDbContext` registers it as **scoped** — one instance per HTTP request, automatically injected into your endpoint. It tracks changes to entities and flushes them on `SaveChangesAsync`. It is *not* thread-safe; one per request is correct.
- **Connection pooling:** Npgsql keeps a pool of open Postgres connections and hands them out per request, so you're not paying TCP/auth handshake cost on every call.

**Checkpoint:** you can add a todo in the browser and see it appear, persisted across API restarts.

---

## Phase 4 — DTOs, validation, and clean layering (60 min)

**Goal:** the API exposes **request/response DTOs**, not raw entities, and rejects invalid input.

**Why / end goal:** right now `POST /api/todos` accepts a full `TodoItem` — a client could try to set `Id`, `IsDone`, or `CreatedAt`. Exposing your database model directly is a classic junior mistake: it leaks internals, creates security holes (over-posting), and couples your API contract to your schema so you can't refactor the DB without breaking clients.

**Tasks:**

1. Define DTOs — `Dtos/TodoDtos.cs`:
   ```csharp
   namespace TaskManager.Api.Dtos;

   public record CreateTodoRequest(string Title);
   public record TodoResponse(Guid Id, string Title, bool IsDone, DateTime CreatedAt);
   ```
2. Add validation. Add the package and a validator:
   ```bash
   dotnet add package FluentValidation.AspNetCore
   ```
   ```csharp
   using FluentValidation;
   using TaskManager.Api.Dtos;

   public class CreateTodoValidator : AbstractValidator<CreateTodoRequest>
   {
       public CreateTodoValidator()
       {
           RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
       }
   }
   ```
   Register: `builder.Services.AddScoped<IValidator<CreateTodoRequest>, CreateTodoValidator>();`
3. Update the POST endpoint to validate and map:
   ```csharp
   app.MapPost("/api/todos", async (AppDbContext db, IValidator<CreateTodoRequest> validator, CreateTodoRequest req) =>
   {
       var result = await validator.ValidateAsync(req);
       if (!result.IsValid) return Results.ValidationProblem(result.ToDictionary());

       var todo = new TodoItem { Title = req.Title };
       db.Todos.Add(todo);
       await db.SaveChangesAsync();

       var dto = new TodoResponse(todo.Id, todo.Title, todo.IsDone, todo.CreatedAt);
       return Results.Created($"/api/todos/{todo.Id}", dto);
   });
   ```
4. Make GET return DTOs too (`.Select(t => new TodoResponse(...))`).
5. Add `PATCH /api/todos/{id}` to toggle `IsDone`, and `DELETE /api/todos/{id}`. Wire toggle + delete buttons into the frontend.

**Concept deep-dive — boundaries:** A DTO is the **contract** between client and server; the entity is your **persistence model**. Keeping them separate lets each change independently — you can add a DB column without touching the API, or reshape the API response without a migration. Validation belongs at the **boundary** (the moment data enters your system) so bad data never reaches your business logic or database. This separation is the seed of "Clean Architecture": endpoints know about DTOs, a service layer holds business rules, and only the data layer knows about EF entities. You don't need formal layers in a one-day app, but you're practicing the instinct.

**Checkpoint:** posting `{"title":""}` returns a 400 with a validation message; valid posts return a clean `TodoResponse`.

---

## Phase 5 — Authentication & per-user data (90 min)

**Goal:** users register and log in; each user only sees their own todos.

**Why / end goal:** a multi-user app needs identity. You'll add ASP.NET Core Identity, issue auth on login, protect endpoints with `[Authorize]`, and scope every query to the current user.

**Tasks:**

1. Add Identity + token packages:
   ```bash
   dotnet add package Microsoft.AspNetCore.Identity.EntityFrameworkCore
   dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
   ```
2. Make your `AppDbContext` inherit `IdentityDbContext<IdentityUser>` instead of `DbContext`, then add a migration (`dotnet ef migrations add AddIdentity` → `database update`). This creates the user/role tables.
3. Add a `UserId` (string) foreign key to `TodoItem`, linking each todo to its owner. Migrate again.
4. Register Identity's ready-made endpoints (.NET ships these so you don't hand-roll password hashing):
   ```csharp
   builder.Services.AddAuthorization();
   builder.Services
       .AddIdentityApiEndpoints<IdentityUser>()
       .AddEntityFrameworkStores<AppDbContext>();

   // app section, ORDER MATTERS — after UseCors, before endpoints:
   app.UseAuthentication();
   app.UseAuthorization();
   app.MapIdentityApi<IdentityUser>(); // gives you /register and /login
   ```
5. Protect the todo endpoints and scope to the user:
   ```csharp
   app.MapGet("/api/todos", async (AppDbContext db, ClaimsPrincipal user) =>
   {
       var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
       return await db.Todos.Where(t => t.UserId == userId)
                            .Select(t => new TodoResponse(t.Id, t.Title, t.IsDone, t.CreatedAt))
                            .ToListAsync();
   }).RequireAuthorization();
   ```
   Set `todo.UserId = userId` on create. Add `.RequireAuthorization()` to every todo endpoint.
6. **Frontend:** add a login page that POSTs to `/login` with `?useCookies=true` (Identity sets an httpOnly cookie). Add `middleware.ts` to redirect unauthenticated users away from `/todos`. Because your CORS policy already allows credentials, include `credentials: "include"` on browser fetches.

**Concept deep-dive:**

- **AuthN vs AuthZ:** *Authentication* = "who are you" (login). *Authorization* = "are you allowed to do this" (`RequireAuthorization`, ownership checks). They're distinct stages in the pipeline — note the two middleware lines, in that order.
- **Cookie vs JWT — the senior tradeoff:** A **JWT** is a self-contained signed token; the client stores it and sends it on each request. Great for APIs consumed by mobile/third parties, but if stored in JS-accessible `localStorage` it's vulnerable to XSS, and it's hard to revoke before expiry. An **httpOnly cookie** can't be read by JavaScript (kills the XSS token-theft vector) and the browser sends it automatically — ideal for a first-party web app like ours, which is why we use `?useCookies=true`. The cost is CSRF risk, mitigated by `SameSite` cookies. Choosing cookie-vs-token *deliberately based on the client* is a senior signal.
- **Row-level scoping:** auth tells you *who* the user is; you still must filter *every* query by `UserId`. Forgetting one `.Where(t => t.UserId == userId)` is how data leaks between users — the most common real-world authorization bug.

**Checkpoint:** logged out, `/api/todos` returns 401. Two different accounts see two different lists.

---

## Phase 6 — Attachments: object storage, lazy/eager loading, CDN (75 min)

**Goal:** attach files to a todo; metadata in Postgres, bytes in object storage, served via a CDN-style URL.

**Why / end goal:** files are the reason you'll learn the **N+1 problem**, **eager vs lazy loading**, and why **binary data doesn't go in your relational DB**.

**Tasks:**

1. Add an `Attachment` entity with a FK to `TodoItem`, and a navigation property:
   ```csharp
   public class Attachment
   {
       public Guid Id { get; set; } = Guid.NewGuid();
       public Guid TodoItemId { get; set; }
       public string FileName { get; set; } = "";
       public string StorageKey { get; set; } = ""; // path/key in blob store
       public string ContentType { get; set; } = "";
       public long SizeBytes { get; set; }
   }
   // on TodoItem:  public List<Attachment> Attachments { get; set; } = [];
   ```
   Migrate.
2. **Local dev storage first** (don't reach for cloud on day one): an upload endpoint that saves the file under `wwwroot/uploads/{guid}` and records an `Attachment` row. Accept `IFormFile`:
   ```csharp
   app.MapPost("/api/todos/{id:guid}/attachments",
       async (Guid id, IFormFile file, AppDbContext db, ClaimsPrincipal user) =>
   {
       // verify the todo belongs to the user (authorization!)
       var key = $"{Guid.NewGuid()}_{file.FileName}";
       var path = Path.Combine("wwwroot/uploads", key);
       await using var stream = File.Create(path);
       await file.CopyToAsync(stream);

       db.Set<Attachment>().Add(new Attachment {
           TodoItemId = id, FileName = file.FileName, StorageKey = key,
           ContentType = file.ContentType, SizeBytes = file.Length });
       await db.SaveChangesAsync();
       return Results.Ok();
   }).RequireAuthorization().DisableAntiforgery();
   ```
   Enable static files: `app.UseStaticFiles();` so `/uploads/{key}` is reachable.
3. Return attachments with each todo using **eager loading**:
   ```csharp
   await db.Todos.Where(t => t.UserId == userId)
                 .Include(t => t.Attachments)   // eager: one JOIN, no N+1
                 .Select(...).ToListAsync();
   ```
4. **Frontend:** a file `<input type="file">` that uploads via `FormData`, then `router.refresh()`.

**Concept deep-dive:**

- **N+1 problem:** if you load 50 todos and then lazily access `.Attachments` per todo, EF fires 1 query for the list + 50 for the attachments = 51 round-trips. `.Include()` (**eager loading**) folds them into one JOIN. **Lazy loading** (navigation properties auto-loaded on access) is convenient but the #1 cause of accidental N+1 and surprise latency in production — seniors prefer explicit `.Include()` so the query count is predictable. That's the nuance behind "use lazy loads" — know it exists, but reach for it deliberately, not by default.
- **Why files leave the database:** storing blobs in Postgres bloats the DB, slows backups, and wastes expensive primary storage on data that never needs querying. The pattern is: **bytes in object storage (S3 / Azure Blob), a row in the DB holding the key + metadata.** In production you'd swap the local-disk code for an S3/Blob SDK call behind the same interface (`IFileStorage`) — your endpoint wouldn't change.
- **CDN + presigned URLs:** a **CDN** caches files at edge locations near users, so downloads are fast and your API isn't a bottleneck. For private files you generate a short-lived **presigned URL** — a temporary signed link to the object — instead of proxying bytes through your API. Today you serve from `/uploads`; the production upgrade is "put a CDN in front of the blob store and hand out presigned URLs."

**Checkpoint:** upload a file to a todo; it appears in the list with a working download link; the API made one query for the list, not N.

---

## Phase 7 — Caching the hot path with Redis (60 min)

**Goal:** the todo list is served from Redis on repeat reads and invalidated on write.

**Why / end goal:** the list endpoint is your most-hit read. Caching it teaches the **cache-aside pattern** and the genuinely hard part of caching — **invalidation**.

**Tasks:**

1. Add Redis:
   ```bash
   dotnet add package Microsoft.Extensions.Caching.StackExchangeRedis
   ```
   ```csharp
   builder.Services.AddStackExchangeRedisCache(o =>
       o.Configuration = "localhost:6379");
   ```
2. Cache-aside in the GET endpoint (key namespaced per user):
   ```csharp
   app.MapGet("/api/todos", async (AppDbContext db, IDistributedCache cache, ClaimsPrincipal user) =>
   {
       var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
       var key = $"todos:{userId}";

       var cached = await cache.GetStringAsync(key);
       if (cached is not null)
           return Results.Ok(JsonSerializer.Deserialize<List<TodoResponse>>(cached));

       var todos = await db.Todos.Where(t => t.UserId == userId)
                   .Include(t => t.Attachments)
                   .Select(t => new TodoResponse(/* ... */))
                   .ToListAsync();

       await cache.SetStringAsync(key, JsonSerializer.Serialize(todos),
           new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5) });
       return Results.Ok(todos);
   }).RequireAuthorization();
   ```
3. **Invalidate** on every write (create/toggle/delete/upload): `await cache.RemoveAsync($"todos:{userId}");`

**Concept deep-dive:**

- **Cache-aside (lazy caching):** the app checks the cache; on a miss it reads the DB, populates the cache, and returns. The cache is a side store, not the source of truth.
- **Invalidation — the hard part:** "There are only two hard things in computer science: cache invalidation and naming things." A stale cache shows users old data. Two safety nets work together: **TTL** (the 5-minute expiry bounds how stale data can ever get) and **explicit invalidation** (delete the key the instant the underlying data changes). Using both means even if you forget an invalidation somewhere, the TTL caps the damage.
- **When *not* to cache:** caching adds a consistency problem. Cache reads that are hot and tolerate slight staleness; don't cache things that must be exactly current (e.g., a payment balance) without more care. Knowing *when not to* is the senior move.
- **Output caching vs distributed caching:** ASP.NET also has *output caching* (cache the whole HTTP response). `IDistributedCache` (Redis) is better here because it's shared across server instances and lets you cache *data* you can reshape — important once you scale horizontally.

**Checkpoint:** load the list twice — the second load logs no DB query. Add a todo — the next load reflects it immediately (invalidation worked).

---

## Phase 8 — Senior polish (use remaining time)

Pick what time allows; each is a real-world necessity.

- **Pagination:** never return unbounded lists. Add `?page=1&pageSize=20` with `.Skip().Take()`. Concept: keyset (cursor) pagination scales better than offset for large tables.
- **Database indexes:** add an index on `TodoItem.UserId` (every query filters on it). Without it, Postgres does a full table scan. `modelBuilder.Entity<TodoItem>().HasIndex(t => t.UserId);`
- **Global error handling:** add exception-handling middleware so unhandled errors return a clean `ProblemDetails` JSON, not a stack trace. Use `app.UseExceptionHandler`.
- **Observability:** add structured logging (Serilog) and a `/health` check that pings Postgres + Redis (`AddHealthChecks().AddNpgSql().AddRedis()`). You can't operate what you can't see.
- **OpenAPI:** .NET 10 emits an OpenAPI document; add Scalar or Swagger UI so the API is self-documenting and testable.
- **Async all the way:** confirm every DB/IO call is `await`ed `...Async` — blocking threads is how .NET apps fall over under load.

---

## Scaling it into "something more powerful" (your runway)

You now have the foundations. The senior growth path from here:

1. **Real cloud storage + CDN** — swap local disk for S3/Azure Blob behind an `IFileStorage` interface; put CloudFront/Azure CDN in front; serve private files via presigned URLs.
2. **Background jobs** — thumbnail generation, virus scanning of uploads, email notifications via a queue (e.g., a hosted background service or a message broker like RabbitMQ/Azure Service Bus). Don't do slow work inside the request.
3. **Real-time** — push live updates (SignalR / WebSockets) so a second device sees changes instantly.
4. **Layered/Clean Architecture** — formalize Endpoints → Application (services, use-cases) → Domain → Infrastructure as the codebase grows; add a service layer between endpoints and EF.
5. **Testing** — unit tests for services, integration tests with Testcontainers (spin up a real Postgres in a container per test run).
6. **CI/CD & containers** — Dockerize the API, build a pipeline (GitHub Actions) that runs migrations and deploys.
7. **Multi-tenancy, rate limiting, soft deletes, audit logs** — the cross-cutting concerns that distinguish a product from a project.

---

## Pacing guide / if you fall behind

This is an **aggressive** full day (≈8–9 focused hours). If you're short on time, the **core path** that still teaches the most is **Phases 1 → 2 → 3 → 5** (hello world both sides, real ORM CRUD, and auth). Attachments (6), caching (7), and polish (8) are the "stretch" tier — each is self-contained, so you can do them on day two without losing momentum. The non-negotiable discipline regardless of pace: **never move to the next phase until the current checkpoint is green.**
