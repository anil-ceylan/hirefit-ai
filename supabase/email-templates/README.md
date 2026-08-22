# HireFit Supabase Auth Email Templates

These files are the branded source templates for Supabase Auth emails.

Apply `confirm-signup.tr.html` to Supabase Auth → Email Templates → Confirm signup for the Turkish product flow.

Subject:

`HireFit • E-posta Adresini Doğrula`

The CTA uses Supabase's `{{ .ConfirmationURL }}` variable and returns users to:

`/verify-email?verified=1`
