using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Threading;

namespace XonticAntiCheatFinal
{
    public partial class DashboardWindow : Window
    {
        private string currentUser;
        private DispatcherTimer updateTimer;

        public DashboardWindow(string username)
        {
            InitializeComponent();
            currentUser = username;

            // تعيين بيانات المستخدم
            txtUsername.Text = username;
            txtWelcomeUser.Text = username;

            // تحميل البيانات
            LoadDashboardData();

            // بدء التحديث التلقائي
            StartAutoUpdate();
        }

        private void LoadDashboardData()
        {
            try
            {
                // بيانات النشاطات
                var activities = new List<ActivityItem>
                {
                    new ActivityItem {
                        Time = DateTime.Now.AddMinutes(-15).ToString("HH:mm"),
                        Action = "Game Session Started",
                        Details = "Match #XNT-1245"
                    },
                    new ActivityItem {
                        Time = DateTime.Now.AddHours(-2).ToString("HH:mm"),
                        Action = "Cheat Detection",
                        Details = "Potential Aimbot detected"
                    },
                    new ActivityItem {
                        Time = DateTime.Now.AddHours(-5).ToString("HH:mm"),
                        Action = "Report Submitted",
                        Details = "Against player 'ShadowHunter'"
                    },
                    new ActivityItem {
                        Time = DateTime.Now.AddHours(-8).ToString("HH:mm"),
                        Action = "Stats Updated",
                        Details = "K/D improved to 2.8"
                    },
                    new ActivityItem {
                        Time = DateTime.Now.AddDays(-1).ToString("dd/MM HH:mm"),
                        Action = "System Update",
                        Details = "Anti-cheat engine v1.2.3"
                    }
                };

                
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error loading data: {ex.Message}", "Error",
                              MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void StartAutoUpdate()
        {
            updateTimer = new DispatcherTimer();
            updateTimer.Interval = TimeSpan.FromSeconds(30); // تحديث كل 30 ثانية
            updateTimer.Tick += UpdateTimer_Tick;
            updateTimer.Start();
        }

        private void UpdateTimer_Tick(object sender, EventArgs e)
        {
            // يمكنك هنا تحديث البيانات الحية
            // مثل عدد المباريات النشطة، التقارير الجديدة، إلخ
        }

        private void BtnReportPlayer_Click(object sender, RoutedEventArgs e)
        {
            ReportWindow reportWindow = new ReportWindow(currentUser);
            reportWindow.Owner = this;
            reportWindow.ShowDialog();

            // تحديث البيانات بعد إغلاق نافذة التقرير
            LoadDashboardData();
        }

        private void BtnReports_Click(object sender, RoutedEventArgs e)
        {
            MessageBox.Show("Reports feature coming soon!\nYou'll be able to view all your submitted reports here.",
                          "Feature Preview",
                          MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void BtnLogout_Click(object sender, RoutedEventArgs e)
        {
            // تأكيد الخروج
            MessageBoxResult result = MessageBox.Show(
                "Are you sure you want to logout?",
                "Confirm Logout",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (result == MessageBoxResult.Yes)
            {
                // إيقاف التحديثات
                if (updateTimer != null)
                    updateTimer.Stop();

                // العودة لشاشة Login
                LoginWindow loginWindow = new LoginWindow();
                loginWindow.Show();
                this.Close();
            }
        }

        protected override void OnClosed(EventArgs e)
        {
            // تنظيف الموارد عند إغلاق النافذة
            if (updateTimer != null)
            {
                updateTimer.Stop();
                updateTimer = null;
            }

            base.OnClosed(e);
        }
    }

    public class ActivityItem
    {
        public string Time { get; set; }
        public string Action { get; set; }
        public string Details { get; set; }
    }
}
