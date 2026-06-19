// C# example for calling the remote anti-cheat API from a desktop application.
// Replace apiUrl, apiKey, and csvPath with your real values.

using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;

public class AntiCheatCloudClient
{
    public static async Task Main()
    {
        string apiUrl = "https://your-api-domain.com";
        string apiKey = "YOUR_SECRET_KEY";
        string csvPath = @"A:\GradProj\Ai Model\test_session.csv";

        using var client = new HttpClient();
        client.DefaultRequestHeaders.Add("X-API-Key", apiKey);

        using var form = new MultipartFormDataContent();
        using var fileStream = File.OpenRead(csvPath);
        using var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/csv");

        form.Add(fileContent, "file", Path.GetFileName(csvPath));

        HttpResponseMessage response = await client.PostAsync($"{apiUrl}/predict-csv", form);
        string responseText = await response.Content.ReadAsStringAsync();

        Console.WriteLine(responseText);
    }
}
