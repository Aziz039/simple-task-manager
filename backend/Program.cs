var builder = WebApplication.CreateBuilder(args);

// builder.Services.AddCors(o => o.AddDefaultPolicy(p => 
//     p.WithOrigins("http://localhost:3000")
//         .AllowAnyMethod()
//         .AllowAnyHeader()
//         .AllowCredentials()
// ));

var app = builder.Build();

// app.UseCors();

app.MapGet("/health", () => new 
{
    status = "ok",
    message = "Hello World from the backend!",
    time = DateTime.UtcNow
});

app.Run();
