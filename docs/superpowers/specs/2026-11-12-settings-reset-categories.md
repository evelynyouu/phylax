# Settings page, password reset by code, and editable categories

Source: the user's request on 2026-11-12, plus their answers to three questions. (The request ended with a pasted block that did not come through; if it held more requirements, add them here.)

## Settings page
A page in the signed-in app where the user can:
- change their profile picture (upload, replace, remove)
- change their name
- change their email, with a verification email before the change takes effect
- change their password
- delete their account
- switch between light and dark mode

Decision: profile pictures are stored in Supabase Storage, in a private `avatars` bucket, one image per user.

## Forgot password
- "Forgot password?" stays on the sign-in page.
- It leads to a page that says "Send a verification email to <email>".
- The email holds a code. After the user enters the code, they choose a new password.

## Categories
- Every bill and subscription has a category, and the user can change it on each one.
- Phylax picks the category automatically; the user's choice wins.
- Decision: automatic sorting is rules only (merchant list plus keyword rules). No merchant names or email content go to any outside service.
- Decision: the categories are Housing and rent, Utilities, Phone and internet, AI and technology, Streaming, Music, Gaming, Storage, Shopping, Learning, Health and fitness, Insurance, Other.
