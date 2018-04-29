#!/bin/bash

# Name of your app.
APP="Allow2Automate"
# The path of your app to sign.
APP_PATH="./dist/mac/Allow2Automate.app"
# The path to the location you want to put the signed package.
RESULT_PATH="./dist/$APP.pkg"
# The name of certificates you requested.
APP_KEY="3rd Party Mac Developer Application: Allow2 Pty Ltd (L44G2T7U48)"
INSTALLER_KEY="3rd Party Mac Developer Installer: Allow2 Pty Ltd (L44G2T7U48)"
# The path of your plist files.
CHILD_PLIST="./child.plist"
PARENT_PLIST="./parent.plist"
LOGINHELPER_PLIST="./loginhelper.plist"

FRAMEWORKS_PATH="$APP_PATH/Contents/Frameworks"

codesign --deep -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Electron Framework.framework"
codesign --deep -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Mantle.framework"
codesign --deep -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/ReactiveCocoa.framework"
codesign --deep -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Squirrel.framework"
codesign --deep -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/$APP Helper.app/"
codesign --deep -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/$APP Helper EH.app/"
codesign --deep -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/$APP Helper NP.app/"
#codesign --deep -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$APP_PATH/Contents/MacOS/$APP"
codesign --deep -s "$APP_KEY" -f --entitlements "$PARENT_PLIST" "$APP_PATH"

productbuild --component "$APP_PATH" /Applications --sign "$INSTALLER_KEY" "$RESULT_PATH"


# for later?
# codesign -s "$APP_KEY" -f --entitlements "$LOGINHELPER_PLIST" "$APP_PATH/Contents/Library/LoginItems/$APP Login Helper.app/Contents/MacOS/$APP Login Helper"
# codesign -s "$APP_KEY" -f --entitlements "$LOGINHELPER_PLIST" "$APP_PATH/Contents/Library/LoginItems/$APP Login Helper.app/"
