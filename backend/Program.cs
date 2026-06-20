var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/health", () => new 
{
    status = "ok",
    message = "Hello World from the backend!",
    time = DateTime.UtcNow
});

app.Run();
