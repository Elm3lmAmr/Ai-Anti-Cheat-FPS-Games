using System;
using System.Windows;

namespace XonticAntiCheatFinal
{
    public partial class ReportWindow : Window
    {
        private string reporterUsername;

        public ReportWindow(string reporter)
        {
            InitializeComponent();
            reporterUsername = reporter;
            cmbCheatType.SelectedIndex = 0;
        }

        private void BtnSubmit_Click(object sender, RoutedEventArgs e)
        {
            string reportedPlayer = txtReportedPlayer.Text.Trim();
            string cheatType = (cmbCheatType.SelectedItem as System.Windows.Controls.ComboBoxItem)?.Content.ToString();

            if (string.IsNullOrEmpty(reportedPlayer))
            {
                MessageBox.Show("Please enter player username", "Error",
                              MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (string.IsNullOrEmpty(cheatType))
            {
                MessageBox.Show("Please select cheat type", "Error",
                              MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            MessageBox.Show($"Report submitted: {reportedPlayer} for {cheatType}",
                          "Success", MessageBoxButton.OK, MessageBoxImage.Information);
            this.Close();
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }
    }
}