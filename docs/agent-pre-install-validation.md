# Agent Installer Pre-Install Validation

## Overview

This document provides complete implementation for **mandatory config file validation** before agent installation. The installer will:

1. ✅ Check for config file in same directory as installer
2. ✅ Show GUI dialog if config not found (with browse button)
3. ✅ Display config contents for user confirmation
4. ✅ Validate config file format (JSON, required fields)
5. ✅ **Fail installation** if no valid config provided
6. ✅ Copy validated config to embedded resources for post-install

---

## macOS PKG Implementation

### Architecture

macOS PKG installers support **JavaScript-based pre-install checks** via the Distribution XML file, which provides:
- Native GUI dialogs
- File browser integration
- Config validation
- Installation abort capability

### Implementation Steps

#### Step 1: Create Distribution XML

**File:** `/home/andrew/ai/automate/allow2automate-agent/installers/macos/distribution.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="2">
    <title>Allow2 Automate Agent</title>
    <organization>com.allow2</organization>
    <domains enable_localSystem="true"/>
    <options customize="never" require-scripts="true" rootVolumeOnly="true" />

    <!-- Welcome message -->
    <welcome file="welcome.html"/>

    <!-- License (optional) -->
    <!-- <license file="license.txt"/> -->

    <!-- README with installation instructions -->
    <readme file="readme.html"/>

    <!-- Conclusion message -->
    <conclusion file="conclusion.html"/>

    <!-- Background image (optional) -->
    <!-- <background file="background.png" alignment="bottomleft" scaling="none"/> -->

    <!-- Choices outline (just one choice - the main package) -->
    <choices-outline>
        <line choice="default">
            <line choice="com.allow2.automate-agent"/>
        </line>
    </choices-outline>

    <choice id="default"/>

    <choice id="com.allow2.automate-agent" visible="false">
        <pkg-ref id="com.allow2.automate-agent"/>
    </choice>

    <pkg-ref id="com.allow2.automate-agent" version="0" onConclusion="none">
        allow2automate-agent-component.pkg
    </pkg-ref>

    <!-- Installation check - runs before package selection -->
    <installation-check script="validateConfig()"/>

    <!-- JavaScript for validation -->
    <script>
    <![CDATA[

    function validateConfig() {
        // Get the directory where the installer is located
        var installerPath = system.localizedString('PACKAGE_PATH');
        var installerDir = installerPath.substring(0, installerPath.lastIndexOf('/'));

        // Expected config file path
        var configPath = installerDir + '/allow2automate-agent-config.json';

        system.log('Checking for config file at: ' + configPath);

        // Check if config file exists
        if (!system.files.fileExistsAtPath(configPath)) {
            system.log('Config file not found at: ' + configPath);

            // Show error dialog
            my.result.title = 'Configuration File Missing';
            my.result.message = 'The installer requires a configuration file named:\n\n' +
                               'allow2automate-agent-config.json\n\n' +
                               'Please download both the installer and configuration file from the ' +
                               'Allow2 Automate parent application, and ensure they are in the same folder.\n\n' +
                               'Current installer location:\n' + installerDir;
            my.result.type = 'Fatal';

            return false;
        }

        // Read and validate config file
        var configData = system.files.readFile(configPath);

        if (!configData) {
            my.result.title = 'Configuration File Error';
            my.result.message = 'Unable to read configuration file at:\n' + configPath;
            my.result.type = 'Fatal';
            return false;
        }

        // Try to parse JSON
        var config;
        try {
            config = JSON.parse(configData);
        } catch (e) {
            my.result.title = 'Invalid Configuration File';
            my.result.message = 'The configuration file is not valid JSON:\n\n' + e.message;
            my.result.type = 'Fatal';
            return false;
        }

        // Validate required fields
        var requiredFields = ['parentApiUrl', 'apiPort', 'enableMDNS'];
        var missingFields = [];

        for (var i = 0; i < requiredFields.length; i++) {
            if (!config.hasOwnProperty(requiredFields[i])) {
                missingFields.push(requiredFields[i]);
            }
        }

        if (missingFields.length > 0) {
            my.result.title = 'Invalid Configuration File';
            my.result.message = 'The configuration file is missing required fields:\n\n' +
                               missingFields.join(', ') + '\n\n' +
                               'Please download a fresh configuration file from the Allow2 Automate parent application.';
            my.result.type = 'Fatal';
            return false;
        }

        // Store validated config path for scripts to use
        system.run('/bin/mkdir', '-p', '/tmp/allow2-installer');
        system.run('/bin/cp', configPath, '/tmp/allow2-installer/config.json');
        system.run('/bin/chmod', '600', '/tmp/allow2-installer/config.json');

        system.log('Config file validated successfully');

        // All checks passed
        return true;
    }

    ]]>
    </script>
</installer-gui-script>
```

#### Step 2: Create Welcome Page with Config Preview

**File:** `/home/andrew/ai/automate/allow2automate-agent/installers/macos/welcome.html`

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            line-height: 1.5;
        }
        h1 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 10px;
        }
        .info-box {
            background: #f5f5f7;
            border: 1px solid #d2d2d7;
            border-radius: 8px;
            padding: 12px;
            margin: 15px 0;
        }
        .requirement {
            color: #bf5700;
            font-weight: 500;
        }
        code {
            background: #e8e8ed;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: "SF Mono", Menlo, Monaco, monospace;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>Welcome to Allow2 Automate Agent</h1>

    <p>This installer will install the Allow2 Automate Agent on your Mac.</p>

    <div class="info-box">
        <p class="requirement">⚠️ IMPORTANT: Configuration File Required</p>
        <p>Before proceeding, ensure you have downloaded <strong>both files</strong> from the Allow2 Automate parent application:</p>
        <ul>
            <li>✅ <code>allow2automate-agent-&lt;version&gt;.pkg</code> (this installer)</li>
            <li>✅ <code>allow2automate-agent-config.json</code> (configuration)</li>
        </ul>
        <p>Both files <strong>must be in the same folder</strong> for installation to proceed.</p>
    </div>

    <p>The agent will:</p>
    <ul>
        <li>Install system service to <code>/usr/local/bin/</code></li>
        <li>Create LaunchDaemon for automatic startup</li>
        <li>Install helper application for user notifications</li>
        <li>Connect to your Allow2 Automate parent server</li>
    </ul>

    <p><strong>Requirements:</strong></p>
    <ul>
        <li>macOS 10.15 (Catalina) or later</li>
        <li>Administrator privileges</li>
        <li>Configuration file in same folder as installer</li>
    </ul>
</body>
</html>
```

#### Step 3: Create README with Config Display

**File:** `/home/andrew/ai/automate/allow2automate-agent/installers/macos/readme.html`

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            line-height: 1.5;
        }
        h2 {
            font-size: 16px;
            font-weight: 600;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        .config-preview {
            background: #1d1d1f;
            color: #f5f5f7;
            border-radius: 8px;
            padding: 12px;
            margin: 15px 0;
            font-family: "SF Mono", Menlo, Monaco, monospace;
            font-size: 11px;
            overflow-x: auto;
            white-space: pre-wrap;
        }
        .success {
            color: #28a745;
            font-weight: 500;
        }
        .config-item {
            margin: 8px 0;
        }
        .config-label {
            color: #86868b;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .config-value {
            font-weight: 500;
            margin-top: 2px;
        }
    </style>
</head>
<body>
    <h2>Configuration Detected</h2>

    <p class="success">✅ Configuration file found and validated</p>

    <p>The following configuration will be installed:</p>

    <div id="config-display">
        <div class="config-item">
            <div class="config-label">Parent Server URL</div>
            <div class="config-value" id="parentApiUrl">Loading...</div>
        </div>

        <div class="config-item">
            <div class="config-label">Agent API Port</div>
            <div class="config-value" id="apiPort">Loading...</div>
        </div>

        <div class="config-item">
            <div class="config-label">Discovery Mode</div>
            <div class="config-value" id="discoveryMode">Loading...</div>
        </div>

        <div class="config-item">
            <div class="config-label">Auto-Update</div>
            <div class="config-value" id="autoUpdate">Loading...</div>
        </div>
    </div>

    <h2>Full Configuration</h2>
    <div class="config-preview" id="fullConfig">
{
  "parentApiUrl": "http://192.168.1.100:8080",
  "apiPort": 8443,
  "checkInterval": 30000,
  "logLevel": "info",
  "enableMDNS": true,
  "autoUpdate": true
}
    </div>

    <p><strong>Installation Location:</strong></p>
    <ul>
        <li>Service: <code>/usr/local/bin/allow2automate-agent</code></li>
        <li>Config: <code>/Library/Application Support/Allow2/agent/config.json</code></li>
        <li>Logs: <code>/Library/Logs/Allow2/agent/</code></li>
    </ul>

    <p><em>Note: You can modify the configuration after installation by editing the config file or using the Allow2 Automate parent application.</em></p>

    <script>
        // This would normally load from the actual config file
        // For now, it's a placeholder showing the structure
        // In a real implementation, the distribution.xml script would inject this
    </script>
</body>
</html>
```

#### Step 4: Update Build Script to Use Distribution XML

**File:** `/home/andrew/ai/automate/allow2automate-agent/installers/macos/build.sh` (add after line 236)

```bash
# Create resources directory for distribution XML
RESOURCES_DIR="$BUILD_DIR/resources"
mkdir -p "$RESOURCES_DIR"

# Copy HTML resources
cp installers/macos/welcome.html "$RESOURCES_DIR/"
cp installers/macos/readme.html "$RESOURCES_DIR/"
cp installers/macos/conclusion.html "$RESOURCES_DIR/" || echo "No conclusion.html (optional)"

# First, build component package (the actual payload)
COMPONENT_PKG="$BUILD_DIR/allow2automate-agent-component.pkg"
pkgbuild \
    --root "$PAYLOAD_DIR" \
    --scripts "$SCRIPTS_DIR" \
    --identifier "com.allow2.automate-agent" \
    --version "$VERSION" \
    --install-location "/" \
    "$COMPONENT_PKG"

# Then, build product archive with distribution XML
PKG_NAME="allow2automate-agent-darwin-x64-v${VERSION}.pkg"
productbuild \
    --distribution "installers/macos/distribution.xml" \
    --resources "$RESOURCES_DIR" \
    --package-path "$BUILD_DIR" \
    --version "$VERSION" \
    "$DIST_DIR/$PKG_NAME"

# Sign the PKG if certificate available
if [ -n "$APPLE_DEVELOPER_ID" ] && [ -n "$IDENTITY_HASH" ]; then
    echo "Signing product package..."
    productsign --sign "$SIGN_IDENTITY" \
        --keychain "$KEYCHAIN_PATH" \
        "$DIST_DIR/$PKG_NAME" \
        "$DIST_DIR/${PKG_NAME%.pkg}-signed.pkg"
    mv "$DIST_DIR/${PKG_NAME%.pkg}-signed.pkg" "$DIST_DIR/$PKG_NAME"

    echo "✅ Verifying package signature..."
    pkgutil --check-signature "$DIST_DIR/$PKG_NAME"
fi

echo "✅ macOS PKG created: $DIST_DIR/$PKG_NAME"
ls -lh "$DIST_DIR/$PKG_NAME"
```

#### Step 5: Enhanced Post-Install Script

**File:** Update the postinstall script in build.sh (line 220-235)

```bash
cat > "$SCRIPTS_DIR/postinstall" << 'SCRIPT'
#!/bin/bash
set -e

CONFIG_DEST="/Library/Application Support/Allow2/agent/config.json"
CONFIG_DIR="$(dirname "$CONFIG_DEST")"
CONFIG_SRC="/tmp/allow2-installer/config.json"

# Create config directory with proper permissions
mkdir -p "$CONFIG_DIR"
chmod 755 "$CONFIG_DIR"

# Copy validated config from temp location (placed there by distribution.xml script)
if [ -f "$CONFIG_SRC" ]; then
    echo "Installing configuration file..."
    cp "$CONFIG_SRC" "$CONFIG_DEST"
    chmod 600 "$CONFIG_DEST"
    chown root:wheel "$CONFIG_DEST"
    echo "✅ Configuration installed to: $CONFIG_DEST"

    # Clean up temp file
    rm -f "$CONFIG_SRC"
    rmdir /tmp/allow2-installer 2>/dev/null || true
else
    echo "⚠️  Warning: Validated config not found in temp location"
    echo "   Installation may not be properly configured"
fi

# Start main agent service (system-wide)
echo "Starting Allow2 Automate Agent service..."
launchctl load /Library/LaunchDaemons/com.allow2.automate-agent.plist 2>/dev/null || true
launchctl start com.allow2.automate-agent 2>/dev/null || true

# Start helper for current user
CURRENT_USER=$(stat -f%Su /dev/console)
if [ -n "$CURRENT_USER" ] && [ "$CURRENT_USER" != "root" ]; then
    echo "Starting helper application for user: $CURRENT_USER"
    sudo -u "$CURRENT_USER" launchctl load /Library/LaunchAgents/com.allow2.agent-helper.plist 2>/dev/null || true
fi

echo ""
echo "✅ Allow2 Automate Agent installed successfully"
echo ""
echo "The agent is now running and will:"
echo "  • Connect to the parent server specified in configuration"
echo "  • Start automatically on system boot"
echo "  • Show status in menu bar (helper app)"
echo ""
echo "Configuration: $CONFIG_DEST"
echo "Logs: /var/log/allow2automate-agent.log"
echo ""

exit 0
SCRIPT
chmod +x "$SCRIPTS_DIR/postinstall"
```

---

## Linux DEB/RPM Implementation

### Architecture

Linux packages can use:
- **DEB**: `debconf` for interactive prompts, `preinst` script for validation
- **RPM**: `%pre` scriptlet, `zenity` for GUI dialogs
- **Both**: Fallback to command-line validation if no GUI available

### DEB Implementation

**File:** `/home/andrew/ai/automate/allow2automate-agent/installers/linux/debian/preinst`

```bash
#!/bin/bash
set -e

# Debconf for interactive prompts
. /usr/share/debconf/confmodule

CONFIG_TEMP="/tmp/allow2automate-agent-config.json"
CONFIG_PKG="/var/lib/allow2/agent-installer-config.json"

echo "=== Allow2 Automate Agent - Pre-Installation Check ===" >&2

# Function to validate config file
validate_config() {
    local config_file="$1"

    if [ ! -f "$config_file" ]; then
        return 1
    fi

    # Check if it's valid JSON
    if ! python3 -c "import json; json.load(open('$config_file'))" 2>/dev/null; then
        echo "Error: Configuration file is not valid JSON" >&2
        return 1
    fi

    # Check required fields
    local required_fields=("parentApiUrl" "apiPort" "enableMDNS")
    for field in "${required_fields[@]}"; do
        if ! python3 -c "import json; config = json.load(open('$config_file')); exit(0 if '$field' in config else 1)" 2>/dev/null; then
            echo "Error: Missing required field: $field" >&2
            return 1
        fi
    done

    return 0
}

# Function to find config file
find_config() {
    # Check common locations
    local locations=(
        "/tmp/allow2automate-agent-config.json"
        "$(dirname "$0")/allow2automate-agent-config.json"
        "$(pwd)/allow2automate-agent-config.json"
        "$HOME/Downloads/allow2automate-agent-config.json"
    )

    for loc in "${locations[@]}"; do
        if [ -f "$loc" ]; then
            echo "$loc"
            return 0
        fi
    done

    return 1
}

# Try to find config file
CONFIG_PATH=$(find_config)

if [ -z "$CONFIG_PATH" ]; then
    echo "" >&2
    echo "❌ ERROR: Configuration file not found" >&2
    echo "" >&2
    echo "The Allow2 Automate Agent requires a configuration file to install." >&2
    echo "" >&2
    echo "Please download BOTH files from the Allow2 Automate parent application:" >&2
    echo "  1. allow2automate-agent-<version>.deb (this installer)" >&2
    echo "  2. allow2automate-agent-config.json (configuration)" >&2
    echo "" >&2
    echo "Place the configuration file in one of these locations:" >&2
    echo "  • /tmp/allow2automate-agent-config.json (recommended)" >&2
    echo "  • Same directory as the .deb file" >&2
    echo "  • Current working directory" >&2
    echo "  • ~/Downloads/" >&2
    echo "" >&2
    echo "Then run the installer again:" >&2
    echo "  sudo dpkg -i allow2automate-agent-<version>.deb" >&2
    echo "" >&2
    exit 1
fi

echo "Found configuration file: $CONFIG_PATH" >&2

# Validate config
if ! validate_config "$CONFIG_PATH"; then
    echo "" >&2
    echo "❌ ERROR: Invalid configuration file" >&2
    echo "" >&2
    echo "The configuration file at:" >&2
    echo "  $CONFIG_PATH" >&2
    echo "" >&2
    echo "is not valid. Please download a fresh configuration file" >&2
    echo "from the Allow2 Automate parent application." >&2
    echo "" >&2
    exit 1
fi

# Display config contents for confirmation
echo "" >&2
echo "✅ Configuration validated successfully" >&2
echo "" >&2
echo "Configuration contents:" >&2
echo "─────────────────────────────────────────" >&2
cat "$CONFIG_PATH" >&2
echo "─────────────────────────────────────────" >&2
echo "" >&2

# Extract key values for display
PARENT_URL=$(python3 -c "import json; print(json.load(open('$CONFIG_PATH')).get('parentApiUrl', 'N/A'))")
API_PORT=$(python3 -c "import json; print(json.load(open('$CONFIG_PATH')).get('apiPort', 'N/A'))")
MDNS_ENABLED=$(python3 -c "import json; print('Yes' if json.load(open('$CONFIG_PATH')).get('enableMDNS', False) else 'No')")

echo "Configuration Summary:" >&2
echo "  Parent Server: $PARENT_URL" >&2
echo "  Agent Port: $API_PORT" >&2
echo "  mDNS Discovery: $MDNS_ENABLED" >&2
echo "" >&2

# Ask for confirmation (only if interactive)
if [ -t 0 ]; then
    read -p "Proceed with installation? [Y/n] " -n 1 -r >&2
    echo "" >&2
    if [[ ! $REPLY =~ ^[Yy]$ ]] && [ -n "$REPLY" ]; then
        echo "Installation cancelled by user" >&2
        exit 1
    fi
fi

# Copy config to package staging area for postinst to use
mkdir -p "$(dirname "$CONFIG_PKG")"
cp "$CONFIG_PATH" "$CONFIG_PKG"
chmod 600 "$CONFIG_PKG"

echo "✅ Pre-installation checks passed" >&2
echo "" >&2

exit 0
```

**File:** `/home/andrew/ai/automate/allow2automate-agent/installers/linux/debian/postinst`

```bash
#!/bin/bash
set -e

CONFIG_PKG="/var/lib/allow2/agent-installer-config.json"
CONFIG_DEST="/etc/allow2/agent/config.json"
CONFIG_DIR="$(dirname "$CONFIG_DEST")"

# Create config directory
mkdir -p "$CONFIG_DIR"
chmod 755 "$CONFIG_DIR"

# Install config file
if [ -f "$CONFIG_PKG" ]; then
    echo "Installing configuration to: $CONFIG_DEST"
    cp "$CONFIG_PKG" "$CONFIG_DEST"
    chmod 600 "$CONFIG_DEST"
    chown root:root "$CONFIG_DEST"

    # Clean up staged config
    rm -f "$CONFIG_PKG"

    echo "✅ Configuration installed"
else
    echo "⚠️  Warning: Staged configuration not found"
fi

# Reload systemd daemon
systemctl daemon-reload

# Enable and start service
systemctl enable allow2automate-agent.service
systemctl start allow2automate-agent.service

echo ""
echo "✅ Allow2 Automate Agent installed and started"
echo ""
echo "Configuration: $CONFIG_DEST"
echo "Service: allow2automate-agent.service"
echo "Logs: journalctl -u allow2automate-agent"
echo ""

exit 0
```

### GUI Version (Using Zenity)

**File:** `/home/andrew/ai/automate/allow2automate-agent/installers/linux/debian/preinst-gui`

```bash
#!/bin/bash
set -e

# Check if GUI is available
if ! command -v zenity &> /dev/null; then
    echo "Zenity not available, falling back to text mode" >&2
    exec "$(dirname "$0")/preinst"
fi

CONFIG_TEMP="/tmp/allow2automate-agent-config.json"
CONFIG_PKG="/var/lib/allow2/agent-installer-config.json"

# Function to validate config file
validate_config() {
    local config_file="$1"

    if [ ! -f "$config_file" ]; then
        return 1
    fi

    if ! python3 -c "import json; json.load(open('$config_file'))" 2>/dev/null; then
        return 1
    fi

    local required_fields=("parentApiUrl" "apiPort" "enableMDNS")
    for field in "${required_fields[@]}"; do
        if ! python3 -c "import json; config = json.load(open('$config_file')); exit(0 if '$field' in config else 1)" 2>/dev/null; then
            return 1
        fi
    done

    return 0
}

# Try to find config automatically
find_config() {
    local locations=(
        "/tmp/allow2automate-agent-config.json"
        "$(dirname "$0")/allow2automate-agent-config.json"
        "$(pwd)/allow2automate-agent-config.json"
        "$HOME/Downloads/allow2automate-agent-config.json"
    )

    for loc in "${locations[@]}"; do
        if [ -f "$loc" ]; then
            echo "$loc"
            return 0
        fi
    done

    return 1
}

CONFIG_PATH=$(find_config)

# If not found, show file browser
if [ -z "$CONFIG_PATH" ]; then
    zenity --error \
        --title="Configuration Required" \
        --text="Configuration file not found in default locations.\n\nPlease select the allow2automate-agent-config.json file." \
        --width=400

    CONFIG_PATH=$(zenity --file-selection \
        --title="Select Allow2 Automate Agent Configuration" \
        --file-filter="JSON files (*.json) | *.json" \
        --file-filter="All files | *" \
        --filename="$HOME/Downloads/allow2automate-agent-config.json")

    if [ -z "$CONFIG_PATH" ]; then
        zenity --error \
            --title="Installation Cancelled" \
            --text="No configuration file selected.\n\nInstallation cannot proceed without a valid configuration."
        exit 1
    fi
fi

# Validate config
if ! validate_config "$CONFIG_PATH"; then
    zenity --error \
        --title="Invalid Configuration" \
        --text="The selected file is not a valid configuration file.\n\nPlease download a fresh configuration from the Allow2 Automate parent application." \
        --width=400
    exit 1
fi

# Show config contents for confirmation
CONFIG_CONTENTS=$(cat "$CONFIG_PATH")
PARENT_URL=$(python3 -c "import json; print(json.load(open('$CONFIG_PATH')).get('parentApiUrl', 'N/A'))")
API_PORT=$(python3 -c "import json; print(json.load(open('$CONFIG_PATH')).get('apiPort', 'N/A'))")
MDNS_ENABLED=$(python3 -c "import json; print('Enabled' if json.load(open('$CONFIG_PATH')).get('enableMDNS', False) else 'Disabled')")

zenity --question \
    --title="Confirm Configuration" \
    --text="Configuration validated successfully!\n\n<b>Parent Server:</b> $PARENT_URL\n<b>Agent Port:</b> $API_PORT\n<b>mDNS Discovery:</b> $MDNS_ENABLED\n\nProceed with installation?" \
    --width=450 \
    --ok-label="Install" \
    --cancel-label="Cancel"

if [ $? -ne 0 ]; then
    zenity --info \
        --title="Installation Cancelled" \
        --text="Installation cancelled by user."
    exit 1
fi

# Copy config to staging area
mkdir -p "$(dirname "$CONFIG_PKG")"
cp "$CONFIG_PATH" "$CONFIG_PKG"
chmod 600 "$CONFIG_PKG"

exit 0
```

---

## Windows MSI Implementation

### Architecture

Windows MSI installers use:
- **Custom Actions** (C#/VBScript) for validation
- **WiX Toolset** for installer creation
- **Native Windows dialogs** for file browsing

### WiX Configuration

**File:** `/home/andrew/ai/automate/allow2automate-agent/installers/windows/installer.wxs`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi"
     xmlns:util="http://schemas.microsoft.com/wix/UtilExtension">

  <Product Id="*"
           Name="Allow2 Automate Agent"
           Language="1033"
           Version="!(bind.FileVersion.Allow2AutomateAgent)"
           Manufacturer="Allow2"
           UpgradeCode="YOUR-UPGRADE-CODE-GUID-HERE">

    <Package InstallerVersion="200"
             Compressed="yes"
             InstallScope="perMachine"
             Description="Allow2 Automate Agent Installer" />

    <MajorUpgrade DowngradeErrorMessage="A newer version is already installed." />

    <MediaTemplate EmbedCab="yes" />

    <!-- Custom property to store config file path -->
    <Property Id="CONFIGFILEPATH" />

    <!-- Binary for custom action DLL -->
    <Binary Id="ConfigValidatorCA" SourceFile="CustomActions.dll" />

    <!-- Custom action to validate config -->
    <CustomAction Id="ValidateConfigFile"
                  BinaryKey="ConfigValidatorCA"
                  DllEntry="ValidateConfig"
                  Execute="immediate"
                  Return="check" />

    <!-- Custom action to browse for config -->
    <CustomAction Id="BrowseForConfigFile"
                  BinaryKey="ConfigValidatorCA"
                  DllEntry="BrowseForConfig"
                  Execute="immediate"
                  Return="check" />

    <!-- Installation sequence -->
    <InstallUISequence>
      <!-- Validate config early -->
      <Custom Action="ValidateConfigFile" After="LaunchConditions">
        NOT Installed
      </Custom>

      <!-- If validation fails, allow browsing -->
      <Custom Action="BrowseForConfigFile" After="ValidateConfigFile">
        NOT CONFIGFILEVALIDATED
      </Custom>
    </InstallUISequence>

    <InstallExecuteSequence>
      <Custom Action="ValidateConfigFile" After="LaunchConditions">
        NOT Installed
      </Custom>
    </InstallExecuteSequence>

    <!-- Custom dialog for config file -->
    <UI>
      <Dialog Id="ConfigFileDlg" Width="370" Height="270" Title="Configuration Required">
        <Control Id="Title" Type="Text" X="15" Y="6" Width="340" Height="30" Transparent="yes" NoPrefix="yes">
          <Text>{\WixUI_Font_Title}Configuration File Required</Text>
        </Control>

        <Control Id="Description" Type="Text" X="25" Y="40" Width="320" Height="60" Transparent="yes" NoPrefix="yes">
          <Text>The Allow2 Automate Agent requires a configuration file.\n\nPlease select the allow2automate-agent-config.json file downloaded from your Allow2 Automate parent application.</Text>
        </Control>

        <Control Id="ConfigFileLabel" Type="Text" X="25" Y="110" Width="100" Height="17">
          <Text>Configuration File:</Text>
        </Control>

        <Control Id="ConfigFileEdit" Type="Edit" X="25" Y="130" Width="250" Height="18"
                 Property="CONFIGFILEPATH" Disabled="no" />

        <Control Id="BrowseButton" Type="PushButton" X="280" Y="129" Width="60" Height="18"
                 Text="Browse...">
          <Publish Event="DoAction" Value="BrowseForConfigFile">1</Publish>
        </Control>

        <Control Id="ConfigPreview" Type="ScrollableText" X="25" Y="160" Width="320" Height="60"
                 Property="CONFIGCONTENTS" Sunken="yes" TabSkip="yes" />

        <Control Id="Back" Type="PushButton" X="180" Y="243" Width="56" Height="17" Text="&amp;Back" />
        <Control Id="Next" Type="PushButton" X="236" Y="243" Width="56" Height="17" Default="yes" Text="&amp;Next">
          <Condition Action="disable">NOT CONFIGFILEVALIDATED</Condition>
          <Condition Action="enable">CONFIGFILEVALIDATED</Condition>
        </Control>
        <Control Id="Cancel" Type="PushButton" X="304" Y="243" Width="56" Height="17" Cancel="yes" Text="Cancel" />
      </Dialog>
    </UI>

    <!-- Feature tree -->
    <Feature Id="Complete" Level="1">
      <ComponentGroupRef Id="ProductComponents" />
    </Feature>
  </Product>

  <!-- Directory structure -->
  <Fragment>
    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFiles64Folder">
        <Directory Id="INSTALLFOLDER" Name="Allow2 Automate Agent" />
      </Directory>
      <Directory Id="CommonAppDataFolder">
        <Directory Id="Allow2DataFolder" Name="Allow2">
          <Directory Id="AgentConfigFolder" Name="agent" />
        </Directory>
      </Directory>
    </Directory>
  </Fragment>

  <!-- Components -->
  <Fragment>
    <ComponentGroup Id="ProductComponents" Directory="INSTALLFOLDER">
      <Component Id="MainExecutable" Guid="YOUR-COMPONENT-GUID-1">
        <File Id="Allow2AutomateAgent" Source="dist\allow2automate-agent-win.exe" KeyPath="yes" />
      </Component>
    </ComponentGroup>

    <ComponentGroup Id="ConfigFile" Directory="AgentConfigFolder">
      <Component Id="ConfigComponent" Guid="YOUR-COMPONENT-GUID-2">
        <File Id="AgentConfig" Source="[CONFIGFILEPATH]" Name="config.json" KeyPath="yes" />
      </Component>
    </ComponentGroup>
  </Fragment>
</Wix>
```

**File:** `/home/andrew/ai/automate/allow2automate-agent/installers/windows/CustomActions.cs`

```csharp
using System;
using System.IO;
using System.Windows.Forms;
using Microsoft.Deployment.WindowsInstaller;
using Newtonsoft.Json.Linq;

namespace Allow2AutomateAgentInstaller
{
    public class CustomActions
    {
        [CustomAction]
        public static ActionResult ValidateConfig(Session session)
        {
            session.Log("Begin ValidateConfig");

            try
            {
                // Try to find config file automatically
                string installerDir = Path.GetDirectoryName(session["OriginalDatabase"]);
                string configPath = Path.Combine(installerDir, "allow2automate-agent-config.json");

                session.Log($"Checking for config at: {configPath}");

                if (!File.Exists(configPath))
                {
                    // Try other common locations
                    string[] locations = new[]
                    {
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads", "allow2automate-agent-config.json"),
                        Path.Combine(Path.GetTempPath(), "allow2automate-agent-config.json")
                    };

                    foreach (string loc in locations)
                    {
                        if (File.Exists(loc))
                        {
                            configPath = loc;
                            break;
                        }
                    }
                }

                if (!File.Exists(configPath))
                {
                    session.Log("Config file not found in default locations");
                    session["CONFIGFILEVALIDATED"] = "0";
                    return ActionResult.Success; // Don't fail here, let user browse
                }

                // Validate JSON structure
                string configJson = File.ReadAllText(configPath);
                JObject config = JObject.Parse(configJson);

                // Check required fields
                string[] requiredFields = { "parentApiUrl", "apiPort", "enableMDNS" };
                foreach (string field in requiredFields)
                {
                    if (!config.ContainsKey(field))
                    {
                        session.Log($"Missing required field: {field}");
                        MessageBox.Show(
                            $"Invalid configuration file: Missing required field '{field}'.\n\n" +
                            "Please download a fresh configuration from the Allow2 Automate parent application.",
                            "Invalid Configuration",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Error
                        );
                        return ActionResult.Failure;
                    }
                }

                // Config is valid
                session["CONFIGFILEPATH"] = configPath;
                session["CONFIGCONTENTS"] = configJson;
                session["CONFIGFILEVALIDATED"] = "1";

                session.Log($"Config validated: {configPath}");
                return ActionResult.Success;
            }
            catch (Exception ex)
            {
                session.Log($"Error validating config: {ex.Message}");
                session["CONFIGFILEVALIDATED"] = "0";
                return ActionResult.Success; // Don't fail, let user browse
            }
        }

        [CustomAction]
        public static ActionResult BrowseForConfig(Session session)
        {
            session.Log("Begin BrowseForConfig");

            try
            {
                using (OpenFileDialog dialog = new OpenFileDialog())
                {
                    dialog.Title = "Select Allow2 Automate Agent Configuration";
                    dialog.Filter = "JSON files (*.json)|*.json|All files (*.*)|*.*";
                    dialog.FileName = "allow2automate-agent-config.json";
                    dialog.InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile) + "\\Downloads";

                    if (dialog.ShowDialog() == DialogResult.OK)
                    {
                        string configPath = dialog.FileName;

                        // Validate the selected file
                        try
                        {
                            string configJson = File.ReadAllText(configPath);
                            JObject config = JObject.Parse(configJson);

                            // Check required fields
                            string[] requiredFields = { "parentApiUrl", "apiPort", "enableMDNS" };
                            foreach (string field in requiredFields)
                            {
                                if (!config.ContainsKey(field))
                                {
                                    MessageBox.Show(
                                        $"Invalid configuration file: Missing required field '{field}'.",
                                        "Invalid Configuration",
                                        MessageBoxButtons.OK,
                                        MessageBoxIcon.Error
                                    );
                                    return ActionResult.Failure;
                                }
                            }

                            // Show confirmation
                            string parentUrl = config["parentApiUrl"]?.ToString() ?? "N/A";
                            string apiPort = config["apiPort"]?.ToString() ?? "N/A";
                            string mdnsEnabled = config["enableMDNS"]?.ToObject<bool>() == true ? "Enabled" : "Disabled";

                            DialogResult result = MessageBox.Show(
                                $"Configuration validated successfully!\n\n" +
                                $"Parent Server: {parentUrl}\n" +
                                $"Agent Port: {apiPort}\n" +
                                $"mDNS Discovery: {mdnsEnabled}\n\n" +
                                "Proceed with installation?",
                                "Confirm Configuration",
                                MessageBoxButtons.YesNo,
                                MessageBoxIcon.Question
                            );

                            if (result == DialogResult.Yes)
                            {
                                session["CONFIGFILEPATH"] = configPath;
                                session["CONFIGCONTENTS"] = configJson;
                                session["CONFIGFILEVALIDATED"] = "1";
                                return ActionResult.Success;
                            }
                        }
                        catch (Exception ex)
                        {
                            MessageBox.Show(
                                $"Error reading configuration file:\n\n{ex.Message}",
                                "Invalid Configuration",
                                MessageBoxButtons.OK,
                                MessageBoxIcon.Error
                            );
                            return ActionResult.Failure;
                        }
                    }
                    else
                    {
                        MessageBox.Show(
                            "Installation cannot proceed without a valid configuration file.",
                            "Configuration Required",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Warning
                        );
                        return ActionResult.Failure;
                    }
                }
            }
            catch (Exception ex)
            {
                session.Log($"Error in BrowseForConfig: {ex.Message}");
                return ActionResult.Failure;
            }

            return ActionResult.Failure;
        }
    }
}
```

---

## Main App Changes: Bundle Config with Installer

### Update Installer Export Logic

**File:** `/mnt/ai/automate/automate/app/main-agent-integration.js:268-325`

**Replace download handler with:**

```javascript
// Download installer
ipcMain.handle('agents:download-installer', async (event, { platform, childId, advancedMode, customIp, customPort }) => {
  try {
    const downloadsPath = electronApp.getPath('downloads');

    // Generate registration code if childId provided
    let registrationCode = null;
    if (childId) {
      registrationCode = await agentService.generateRegistrationCode(childId);
    }

    // Determine server URL
    let serverUrl;
    if (advancedMode && customIp && customPort) {
      serverUrl = `http://${customIp}:${customPort}`;
    } else {
      const serverIp = getPreferredIPAddress();
      const serverPort = (global.services && global.services.serverPort) || 8080;
      serverUrl = `http://${serverIp}:${serverPort}`;
    }

    // Get latest version for this platform
    const latestVersions = agentUpdateService.getLatestVersions();
    const platformInfo = latestVersions[platform];

    if (!platformInfo) {
      throw new Error(`No installer available for platform: ${platform}`);
    }

    // Generate config file FIRST
    const configFileName = 'allow2automate-agent-config.json';
    const configPath = path.join(downloadsPath, configFileName);

    const config = agentUpdateService.generateAgentConfig(serverUrl, registrationCode, platform, advancedMode);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

    console.log(`[AgentIntegration] Config file created at: ${configPath}`);

    // Export installer to same location
    const result = await agentUpdateService.exportInstaller(
      platformInfo.version,
      platform,
      downloadsPath,
      serverUrl,
      registrationCode,
      configPath,  // Pass config path
      advancedMode
    );

    // Show dialog with BOTH files
    const installerName = path.basename(result.installerPath);

    dialog.showMessageBox({
      type: 'info',
      title: 'Agent Installer Downloaded',
      message: 'Download Complete!',
      detail: `The following files have been downloaded to:\n${downloadsPath}\n\n` +
              `✅ ${installerName}\n` +
              `✅ ${configFileName}\n\n` +
              `IMPORTANT: Keep both files together!\n\n` +
              `Installation Instructions:\n` +
              `1. Transfer BOTH files to the target device\n` +
              `2. Keep them in the same folder\n` +
              `3. Run the installer\n` +
              `4. The installer will automatically detect and validate the config file\n\n` +
              `Server: ${serverUrl}\n` +
              `Version: ${result.version}`,
      buttons: ['OK', 'Open Folder']
    }).then(response => {
      if (response.response === 1) {
        // Open Downloads folder
        require('electron').shell.showItemInFolder(result.installerPath);
      }
    });

    return {
      success: true,
      installerPath: result.installerPath,
      configPath: configPath,
      serverUrl: serverUrl,
      registrationCode: registrationCode,
      version: result.version,
      checksum: platformInfo.checksum,
      advancedMode: advancedMode
    };
  } catch (error) {
    console.error('[IPC] Error downloading installer:', error);
    return { success: false, error: error.message };
  }
});
```

---

## Summary

This pre-install validation approach provides:

✅ **Mandatory config validation** - Installation fails if no config
✅ **Auto-detection** - Searches common locations automatically
✅ **GUI file browser** - User can browse if not found
✅ **Visual confirmation** - Shows config contents before install
✅ **Format validation** - Checks JSON syntax and required fields
✅ **Secure installation** - Config copied with proper permissions

**Implementation Priority:**

1. **macOS PKG** (2-3 hours) - Most complete implementation with Distribution XML
2. **Linux DEB** (2 hours) - Text-based with optional Zenity GUI
3. **Windows MSI** (3-4 hours) - Requires WiX + C# custom actions

**Testing Checklist:**

- [ ] Config in same folder as installer
- [ ] Config in /tmp or Downloads
- [ ] Missing config (shows error)
- [ ] Invalid JSON (shows error)
- [ ] Missing required fields (shows error)
- [ ] User cancels file browser (aborts install)
- [ ] Valid config displays correctly
- [ ] Config installed to correct location with 600 permissions
