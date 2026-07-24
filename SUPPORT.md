# Support

## Where To Ask For Help

- **Official website:** [halaldl.vercel.app](https://halaldl.vercel.app)
- **Bug reports:** use [GitHub Issues](https://github.com/Asdmir786/HalalDL/issues/new/choose)
- **Feature ideas:** use [GitHub Issues](https://github.com/Asdmir786/HalalDL/issues/new/choose) or Discussions if enabled
- **Security concerns:** follow [SECURITY.md](./SECURITY.md)

## Before Opening An Issue

Please include the basics:

- HalalDL version
- Windows version
- Whether you are using Full or Lite
- The exact behavior you expected
- The exact behavior you saw
- Relevant logs or screenshots

The fastest way to attach the basics is **Copy support info** in HalalDL
(Settings → About, Settings → Performance, or Logs). Paste that block into
the issue. It includes mode, package type, tool status, and startup timings.

## Common Checks

- Confirm you are on the latest release
- If using Lite, verify `yt-dlp` and `ffmpeg` are installed and reachable
- Re-run the action once with logs open
- Check whether the problem is specific to one URL or all URLs
- If downloads feel slow to *start* (not download speed), Windows Defender may be
  scanning `yt-dlp.exe` on each launch. Adding an exclusion for HalalDL’s `bin`
  folder can help; only do this if you trust your install source.

## Privacy Reminder

Do not paste secrets, cookies, private links, or personal filesystem details into public issues unless they are necessary and safe to share.
