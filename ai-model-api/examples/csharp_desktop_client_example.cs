// Minimal C# example for a WinForms/WPF desktop application.
// Install no special ML package in the desktop app. Just call the local API.

using System;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;

public class AntiCheatApiClient
{
    private readonly HttpClient _httpClient = new HttpClient();
    private readonly string _apiBaseUrl = "http://127.0.0.1:8000";

    public async Task<string> PredictCsvAsync(string csvPath)
    {
        using var form = new MultipartFormDataContent();
        using var fileStream = File.OpenRead(csvPath);
        form.Add(new StreamContent(fileStream), "file", Path.GetFileName(csvPath));

        var response = await _httpClient.PostAsync($"{_apiBaseUrl}/predict-csv", form);
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadAsStringAsync();
    }
}

// Usage inside a button click:
// var client = new AntiCheatApiClient();
// string resultJson = await client.PredictCsvAsync(@"A:\GradProj\Ai Model\session.csv");
// MessageBox.Show(resultJson);
