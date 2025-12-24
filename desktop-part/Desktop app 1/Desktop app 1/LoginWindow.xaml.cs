using System;
using System.Windows;
using System.Windows.Input;

namespace XonticAntiCheatFinal
{
    public partial class LoginWindow : Window
    {
        public LoginWindow()
        {
            InitializeComponent();
            txtUsername.Focus();
        }

        private void BtnLogin_Click(object sender, RoutedEventArgs e)
        {
            string username = txtUsername.Text.Trim();
            string password = txtPassword.Password;

            // التحقق البسيط
            if (string.IsNullOrEmpty(username))
            {
                ShowError("Please enter your username");
                txtUsername.Focus();
                return;
            }

            if (string.IsNullOrEmpty(password))
            {
                ShowError("Please enter your password");
                txtPassword.Focus();
                return;
            }

            // محاكاة تسجيل الدخول (في المستقبل ستتصل بقاعدة البيانات)
            bool loginSuccess = AuthenticateUser(username, password);

            if (loginSuccess)
            {
                // الانتقال للداشبورد
                DashboardWindow dashboard = new DashboardWindow(username);
                dashboard.Show();
                this.Close();
            }
            else
            {
                ShowError("Invalid username or password");
                txtPassword.SelectAll();
                txtPassword.Focus();
            }
        }

        private bool AuthenticateUser(string username, string password)
        {
            // للاختبار، نقبل:
            // username: admin, password: 1234
            // أو أي اسم وكلمة سر غير فارغة

            if (username == "admin" && password == "1234")
                return true;

            // للاختبار، نقبل أي بيانات غير فارغة
            return !string.IsNullOrEmpty(username) && !string.IsNullOrEmpty(password);
        }

        private void ShowError(string message)
        {
            txtError.Text = message;
            errorBorder.Visibility = Visibility.Visible;
        }

        private void HideError()
        {
            errorBorder.Visibility = Visibility.Collapsed;
        }

        private void TxtSignUp_MouseDown(object sender, MouseButtonEventArgs e)
        {
            RegisterWindow registerWindow = new RegisterWindow();
            registerWindow.Owner = this;
            registerWindow.ShowDialog();
        }

        // عند الكتابة في الحقول، إخفاء رسالة الخطأ
        private void TxtUsername_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            HideError();
        }

        private void TxtPassword_PasswordChanged(object sender, RoutedEventArgs e)
        {
            HideError();
        }

        // Enter key to login
        private void TxtPassword_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                BtnLogin_Click(sender, e);
            }
        }
    }
}