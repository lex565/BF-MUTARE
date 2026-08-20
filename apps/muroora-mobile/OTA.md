# Shipping a change to the app without a new APK

    npm run ship -- "what changed"

That publishes the current JavaScript to the `preview` branch at runtime
version 0.2.0, which is what the APK testers are holding was built from. They
get it the next time they open the app. No new download, no reinstall, no
Play Store.

## What this CAN ship

Anything written in JavaScript or TypeScript: screens, copy, layout, fixes,
new API calls, whole new flows built from components already in the binary.

## What this CANNOT ship

A native module. `eas update` replaces the JavaScript bundle inside an
existing binary; it cannot add code the binary does not contain. Adding a
library with a native side - a camera, a scanner, a maps SDK, background
location - means a new APK and every tester reinstalling.

This is why the business registration work deliberately used
expo-image-picker's own `quality` option instead of expo-image-manipulator:
the manipulator would have forced a rebuild, and the fix reached existing
phones over the air instead. Keep it that way where there is a choice.

## The one rule that will bite

Updates are matched on **runtime version plus channel**, not on the package
name. Bumping the app version in app.json changes the runtime version, which
means phones on the old version stop receiving updates until they install a
new APK. Do not bump the version to mean "this is newer" - it means "this
needs a new binary".

## Checking it landed

    eas update:list --branch preview

The EAS dashboard shows which update each install has picked up:
https://expo.dev/accounts/muroora-mart/projects/muroora-beta/updates
