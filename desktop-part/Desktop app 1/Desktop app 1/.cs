using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace XonticAntiCheatFinal.Services
{
    public class GameMonitorService
    {
        // Events
        public event Action<string> OnGameStatusChanged;
        public event Action<GameSession> OnSessionUpdated;
        public event Action<Exception> OnError;

        // Game Process
        private Process gameProcess;
        private Timer monitorTimer;
        private DateTime sessionStartTime;
        private bool isMonitoring;

        // Game Info
        public class GameSession
        {
            public bool IsRunning { get; set; }
            public TimeSpan SessionTime { get; set; }
            public int ProcessId { get; set; }
            public string GameVersion { get; set; }
            public DateTime StartTime { get; set; }
        }

        public GameMonitorService()
        {
            // تهيئة الخدمة
        }

        public void StartMonitoring()
        {
            if (isMonitoring) return;

            isMonitoring = true;
            monitorTimer = new Timer(CheckGameStatus, null, 0, 2000); // فحص كل 2 ثانية

            OnGameStatusChanged?.Invoke("Monitoring started");
        }

        public void StopMonitoring()
        {
            isMonitoring = false;
            monitorTimer?.Dispose();
            OnGameStatusChanged?.Invoke("Monitoring stopped");
        }

        private void CheckGameStatus(object state)
        {
            try
            {
                bool wasRunning = gameProcess != null && !gameProcess.HasExited;
                bool isNowRunning = IsGameRunning();

                if (!wasRunning && isNowRunning)
                {
                    // Game started
                    gameProcess = GetGameProcess();
                    sessionStartTime = DateTime.Now;

                    OnGameStatusChanged?.Invoke("Game started");
                    OnSessionUpdated?.Invoke(new GameSession
                    {
                        IsRunning = true,
                        ProcessId = gameProcess?.Id ?? 0,
                        StartTime = sessionStartTime,
                        GameVersion = GetGameVersion()
                    });
                }
                else if (wasRunning && !isNowRunning)
                {
                    // Game stopped
                    OnGameStatusChanged?.Invoke("Game stopped");
                    gameProcess = null;

                    OnSessionUpdated?.Invoke(new GameSession
                    {
                        IsRunning = false,
                        SessionTime = DateTime.Now - sessionStartTime
                    });
                }
                else if (isNowRunning)
                {
                    // Game is running, update session time
                    OnSessionUpdated?.Invoke(new GameSession
                    {
                        IsRunning = true,
                        SessionTime = DateTime.Now - sessionStartTime,
                        ProcessId = gameProcess?.Id ?? 0
                    });
                }
            }
            catch (Exception ex)
            {
                OnError?.Invoke(ex);
            }
        }

        public bool LaunchGame(string gamePath = null)
        {
            try
            {
                if (IsGameRunning())
                {
                    OnGameStatusChanged?.Invoke("Game is already running");
                    return false;
                }

                string path = gamePath ?? FindGamePath();

                if (string.IsNullOrEmpty(path) || !File.Exists(path))
                {
                    OnGameStatusChanged?.Invoke("Game not found");
                    return false;
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = path,
                    WorkingDirectory = Path.GetDirectoryName(path),
                    UseShellExecute = true
                };

                gameProcess = Process.Start(startInfo);
                sessionStartTime = DateTime.Now;

                OnGameStatusChanged?.Invoke("Game launched successfully");
                return true;
            }
            catch (Exception ex)
            {
                OnError?.Invoke(ex);
                OnGameStatusChanged?.Invoke($"Launch failed: {ex.Message}");
                return false;
            }
        }

        public bool CloseGame()
        {
            try
            {
                if (gameProcess != null && !gameProcess.HasExited)
                {
                    gameProcess.CloseMainWindow();

                    if (!gameProcess.WaitForExit(5000)) // انتظار 5 ثواني
                    {
                        gameProcess.Kill();
                    }

                    gameProcess = null;
                    OnGameStatusChanged?.Invoke("Game closed");
                    return true;
                }

                return false;
            }
            catch (Exception ex)
            {
                OnError?.Invoke(ex);
                return false;
            }
        }

        private bool IsGameRunning()
        {
            var processes = Process.GetProcessesByName("xontic");
            if (processes.Length == 0)
                processes = Process.GetProcessesByName("xontic-game");
            if (processes.Length == 0)
                processes = Process.GetProcessesByName("Xontic");

            return processes.Length > 0;
        }

        private Process GetGameProcess()
        {
            var processes = Process.GetProcessesByName("xontic");
            if (processes.Length == 0)
                processes = Process.GetProcessesByName("xontic-game");
            if (processes.Length == 0)
                processes = Process.GetProcessesByName("Xontic");

            return processes.Length > 0 ? processes[0] : null;
        }

        private string FindGamePath()
        {
            // مواقع محتملة للعبة
            string[] possiblePaths =
            {
                @"C:\Program Files\Xontic\Xontic.exe",
                @"C:\Program Files (x86)\Xontic\Xontic.exe",
                @"D:\Games\Xontic\Xontic.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Xontic", "Xontic.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Xontic", "Xontic.exe")
            };

            foreach (var path in possiblePaths)
            {
                if (File.Exists(path))
                    return path;
            }

            return null;
        }

        private string GetGameVersion()
        {
            try
            {
                if (gameProcess != null)
                {
                    var fileVersion = FileVersionInfo.GetVersionInfo(gameProcess.MainModule.FileName);
                    return fileVersion.FileVersion ?? "Unknown";
                }
            }
            catch { }

            return "Unknown";
        }

        public GameSession GetCurrentSession()
        {
            return new GameSession
            {
                IsRunning = IsGameRunning(),
                SessionTime = gameProcess != null ? DateTime.Now - sessionStartTime : TimeSpan.Zero,
                ProcessId = gameProcess?.Id ?? 0,
                StartTime = sessionStartTime
            };
        }
    }
}