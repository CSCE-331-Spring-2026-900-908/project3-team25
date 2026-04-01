
# Accessibility Features Approval

This update adds real accessibility support for the Sprint MVP instead of only browser zoom.

## Implemented Features

1. **Voice Guide / Spoken UI labels**
   - A Voice Guide toggle was added to every main page.
   - When enabled, the page reads out focused and clicked controls using the browser Speech Synthesis API.
   - Buttons, links, category tabs, payment options, and drink cards announce what they are.

2. **Background music control**
   - Background music now starts muted by default.
   - Users can choose to unmute it manually.
   - This prevents audio from interfering with screen-reader style interaction.

3. **High contrast mode**
   - Added a high-contrast toggle to improve readability for users with low vision.

4. **Reduced motion mode**
   - Added a reduced-motion toggle that disables decorative animations and transitions.

5. **Skip to main content**
   - Added a skip link for keyboard and assistive-technology users.

6. **Live announcements**
   - Added an ARIA live region so important UI messages can be announced to assistive technology.

7. **Keyboard accessibility improvements**
   - Interactive cards and controls now receive clearer labels and stronger focus behavior.

## Accessibility Personas Supported

- Low-vision users: high contrast mode, stronger focus visibility
- Users sensitive to motion: reduced motion mode
- Users needing spoken guidance: Voice Guide spoken labels
- Keyboard-only users: skip link and focus improvements
- Users distracted by background sound: music mute/unmute control
