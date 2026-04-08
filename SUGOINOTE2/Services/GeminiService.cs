using System.Text;
using System.Text.Json; // Usamos el nativo de .NET para no instalar nada extra

namespace SUGOINOTE2.Services
{
    public class GeminiService
    {
        private readonly string _apiKey = "TU_API_KEY_AQUI"; // Luego pondremos tu clave
        private readonly HttpClient _httpClient;

        public GeminiService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<string> GenerarContenidoIA(string prompt)
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={_apiKey}";

            var requestBody = new
            {
                contents = new[] { new { parts = new[] { new { text = prompt } } } }
            };

            var json = JsonSerializer.Serialize(requestBody);
            // Esto soluciona el error CS1503
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(url, content);
            return await response.Content.ReadAsStringAsync();
        }
    }
}