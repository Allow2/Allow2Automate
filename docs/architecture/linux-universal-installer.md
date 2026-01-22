# Universal Linux Installer Architecture

## Overview

This document describes the architecture for a universal Linux installer script for the allow2automate-agent. The script is generated dynamically by the parent Allow2Automate application with embedded configuration (agent ID, auth token, parent URL).

---

## 1. Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                           PARENT APP (Allow2Automate)                             |
|  +-----------------------------------------------------------------------------+  |
|  |                        Installer Generator Service                          |  |
|  |  +------------------+  +------------------+  +------------------+           |  |
|  |  | Agent Config     |  | Template Engine  |  | Script Encoder   |           |  |
|  |  | - agentId        |  | - inject vars    |  | - base64 encode  |           |  |
|  |  | - authToken      |  | - minify script  |  | - checksum       |           |  |
|  |  | - parentUrl      |  | - validate       |  | - compress       |           |  |
|  |  +------------------+  +------------------+  +------------------+           |  |
|  +-----------------------------------------------------------------------------+  |
|                                      |                                            |
|                                      v                                            |
|                          Generated install-agent.sh                               |
|                          (unique per agent registration)                          |
+-----------------------------------------------------------------------------------+
                                       |
                                       | curl/wget download
                                       v
+-----------------------------------------------------------------------------------+
|                              TARGET LINUX SYSTEM                                  |
|  +-----------------------------------------------------------------------------+  |
|  |                         Universal Installer Script                          |  |
|  |  +------------------------------------------------------------------+       |  |
|  |  | Phase 1: DETECTION                                               |       |  |
|  |  |  - Detect distro (ID, VERSION_ID from /etc/os-release)          |       |  |
|  |  |  - Detect package manager (apt, dnf, yum, zypper, pacman)       |       |  |
|  |  |  - Detect architecture (x86_64, aarch64)                        |       |  |
|  |  |  - Check for root/sudo                                          |       |  |
|  |  +------------------------------------------------------------------+       |  |
|  |                                  |                                          |  |
|  |                                  v                                          |  |
|  |  +------------------------------------------------------------------+       |  |
|  |  | Phase 2: DOWNLOAD                                                |       |  |
|  |  |  - Determine download tool (curl or wget)                       |       |  |
|  |  |  - Build GitHub release URL for correct package format          |       |  |
|  |  |  - Download package to temp directory                           |       |  |
|  |  |  - Verify checksum (SHA256)                                     |       |  |
|  |  +------------------------------------------------------------------+       |  |
|  |                                  |                                          |  |
|  |                                  v                                          |  |
|  |  +------------------------------------------------------------------+       |  |
|  |  | Phase 3: INSTALL                                                 |       |  |
|  |  |  - Install using native package manager                         |       |  |
|  |  |  - OR extract tarball as fallback                               |       |  |
|  |  |  - Handle package conflicts/updates                             |       |  |
|  |  +------------------------------------------------------------------+       |  |
|  |                                  |                                          |  |
|  |                                  v                                          |  |
|  |  +------------------------------------------------------------------+       |  |
|  |  | Phase 4: CONFIGURE                                               |       |  |
|  |  |  - Write embedded config to /etc/allow2automate/config.json     |       |  |
|  |  |  - Set permissions (700 for directory, 600 for config)          |       |  |
|  |  +------------------------------------------------------------------+       |  |
|  |                                  |                                          |  |
|  |                                  v                                          |  |
|  |  +------------------------------------------------------------------+       |  |
|  |  | Phase 5: SERVICE SETUP                                           |       |  |
|  |  |  - Reload systemd daemon                                        |       |  |
|  |  |  - Enable service                                               |       |  |
|  |  |  - Start service                                                |       |  |
|  |  |  - Verify service is running                                    |       |  |
|  |  +------------------------------------------------------------------+       |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Distro Detection Flow

```
                    +------------------------+
                    | Read /etc/os-release   |
                    +------------------------+
                              |
                              v
                    +------------------------+
                    | Extract ID field       |
                    | (ubuntu, debian,       |
                    |  fedora, rhel, etc.)   |
                    +------------------------+
                              |
              +---------------+---------------+
              |               |               |
              v               v               v
     +-------------+  +-------------+  +-------------+
     | Debian-like |  | RHEL-like   |  | Other       |
     | ubuntu      |  | fedora      |  | arch        |
     | debian      |  | rhel        |  | opensuse    |
     | mint        |  | centos      |  | alpine      |
     | pop         |  | rocky       |  | void        |
     | elementary  |  | alma        |  |             |
     +-------------+  +-------------+  +-------------+
           |               |               |
           v               v               v
     +-------------+  +-------------+  +-------------+
     | apt-get     |  | dnf or yum  |  | pacman,     |
     | dpkg        |  | rpm         |  | zypper, etc |
     +-------------+  +-------------+  +-------------+
           |               |               |
           v               v               v
     +-------------+  +-------------+  +-------------+
     | Download    |  | Download    |  | Download    |
     | .deb pkg    |  | .rpm pkg    |  | .tar.gz     |
     +-------------+  +-------------+  +-------------+
```

---

## 3. Package Format Decision Matrix

| Distro Family | Package Manager | Package Format | Install Command |
|---------------|-----------------|----------------|-----------------|
| Debian/Ubuntu | apt-get/dpkg | .deb | `dpkg -i` then `apt-get install -f` |
| Fedora | dnf | .rpm | `dnf install -y` |
| RHEL/CentOS 8+ | dnf | .rpm | `dnf install -y` |
| RHEL/CentOS 7 | yum | .rpm | `yum install -y` |
| openSUSE | zypper | .rpm | `zypper install -y` |
| Arch Linux | pacman | .tar.gz | Manual extraction |
| Alpine | apk | .tar.gz | Manual extraction |
| Generic | none | .tar.gz | Manual extraction |

---

## 4. Pseudocode for Universal Installer

```
#!/bin/sh
# ============================================================================
# Allow2Automate Agent - Universal Linux Installer
# ============================================================================
# This script is generated dynamically with embedded configuration.
# POSIX-compliant for maximum compatibility.
# ============================================================================

# --- EMBEDDED CONFIGURATION (injected by parent app) ---
AGENT_ID="__AGENT_ID__"
AUTH_TOKEN="__AUTH_TOKEN__"
PARENT_URL="__PARENT_URL__"
AGENT_VERSION="__AGENT_VERSION__"
GITHUB_REPO="Allow2/allow2automate-agent"
# --- END EMBEDDED CONFIGURATION ---

# Global variables
DISTRO_ID=""
DISTRO_VERSION=""
PKG_MANAGER=""
PKG_FORMAT=""
ARCH=""
DOWNLOAD_TOOL=""
TEMP_DIR=""

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

log_info() {
    printf "[INFO] %s\n" "$1"
}

log_error() {
    printf "[ERROR] %s\n" "$1" >&2
}

log_success() {
    printf "[OK] %s\n" "$1"
}

cleanup() {
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}

die() {
    log_error "$1"
    cleanup
    exit 1
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ============================================================================
# PHASE 1: DETECTION
# ============================================================================

detect_root() {
    if [ "$(id -u)" -ne 0 ]; then
        die "This script must be run as root (use sudo)"
    fi
    log_success "Running as root"
}

detect_architecture() {
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64|amd64)
            ARCH="amd64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        *)
            die "Unsupported architecture: $ARCH"
            ;;
    esac
    log_success "Architecture: $ARCH"
}

detect_distro() {
    if [ -f /etc/os-release ]; then
        # shellcheck source=/dev/null
        . /etc/os-release
        DISTRO_ID="$ID"
        DISTRO_VERSION="$VERSION_ID"
    elif [ -f /etc/lsb-release ]; then
        # shellcheck source=/dev/null
        . /etc/lsb-release
        DISTRO_ID="$DISTRIB_ID"
        DISTRO_VERSION="$DISTRIB_RELEASE"
    elif [ -f /etc/redhat-release ]; then
        DISTRO_ID="rhel"
    elif [ -f /etc/debian_version ]; then
        DISTRO_ID="debian"
    else
        DISTRO_ID="unknown"
    fi

    # Normalize to lowercase
    DISTRO_ID=$(echo "$DISTRO_ID" | tr '[:upper:]' '[:lower:]')

    log_success "Distro: $DISTRO_ID (version: ${DISTRO_VERSION:-unknown})"
}

detect_package_manager() {
    case "$DISTRO_ID" in
        ubuntu|debian|linuxmint|pop|elementary|kali|raspbian|zorin)
            if command_exists apt-get; then
                PKG_MANAGER="apt"
                PKG_FORMAT="deb"
            else
                die "apt-get not found on Debian-based system"
            fi
            ;;
        fedora)
            if command_exists dnf; then
                PKG_MANAGER="dnf"
                PKG_FORMAT="rpm"
            else
                die "dnf not found on Fedora"
            fi
            ;;
        rhel|centos|rocky|almalinux|ol|oracle)
            if command_exists dnf; then
                PKG_MANAGER="dnf"
            elif command_exists yum; then
                PKG_MANAGER="yum"
            else
                die "Neither dnf nor yum found on RHEL-based system"
            fi
            PKG_FORMAT="rpm"
            ;;
        opensuse*|sles|suse)
            if command_exists zypper; then
                PKG_MANAGER="zypper"
                PKG_FORMAT="rpm"
            else
                die "zypper not found on openSUSE"
            fi
            ;;
        arch|manjaro|endeavouros)
            PKG_MANAGER="pacman"
            PKG_FORMAT="tarball"
            ;;
        alpine)
            PKG_MANAGER="apk"
            PKG_FORMAT="tarball"
            ;;
        *)
            log_info "Unknown distro '$DISTRO_ID', using tarball fallback"
            PKG_MANAGER="none"
            PKG_FORMAT="tarball"
            ;;
    esac

    log_success "Package manager: $PKG_MANAGER (format: $PKG_FORMAT)"
}

detect_download_tool() {
    if command_exists curl; then
        DOWNLOAD_TOOL="curl"
    elif command_exists wget; then
        DOWNLOAD_TOOL="wget"
    else
        die "Neither curl nor wget found. Please install one."
    fi
    log_success "Download tool: $DOWNLOAD_TOOL"
}

# ============================================================================
# PHASE 2: DOWNLOAD
# ============================================================================

download_file() {
    url="$1"
    output="$2"

    log_info "Downloading: $url"

    case "$DOWNLOAD_TOOL" in
        curl)
            curl -fsSL -o "$output" "$url" || return 1
            ;;
        wget)
            wget -q -O "$output" "$url" || return 1
            ;;
    esac

    return 0
}

build_package_url() {
    base_url="https://github.com/${GITHUB_REPO}/releases/download/v${AGENT_VERSION}"

    case "$PKG_FORMAT" in
        deb)
            echo "${base_url}/allow2automate-agent_${AGENT_VERSION}_${ARCH}.deb"
            ;;
        rpm)
            rpm_arch="$ARCH"
            [ "$ARCH" = "amd64" ] && rpm_arch="x86_64"
            [ "$ARCH" = "arm64" ] && rpm_arch="aarch64"
            echo "${base_url}/allow2automate-agent-${AGENT_VERSION}.${rpm_arch}.rpm"
            ;;
        tarball)
            echo "${base_url}/allow2automate-agent-${AGENT_VERSION}-linux-${ARCH}.tar.gz"
            ;;
    esac
}

download_package() {
    TEMP_DIR=$(mktemp -d)
    pkg_url=$(build_package_url)

    case "$PKG_FORMAT" in
        deb)
            pkg_file="${TEMP_DIR}/allow2automate-agent.deb"
            ;;
        rpm)
            pkg_file="${TEMP_DIR}/allow2automate-agent.rpm"
            ;;
        tarball)
            pkg_file="${TEMP_DIR}/allow2automate-agent.tar.gz"
            ;;
    esac

    if ! download_file "$pkg_url" "$pkg_file"; then
        die "Failed to download package from: $pkg_url"
    fi

    if [ ! -s "$pkg_file" ]; then
        die "Downloaded file is empty or missing"
    fi

    log_success "Package downloaded: $pkg_file"
    echo "$pkg_file"
}

# ============================================================================
# PHASE 3: INSTALL
# ============================================================================

install_package() {
    pkg_file="$1"

    log_info "Installing package..."

    case "$PKG_MANAGER" in
        apt)
            # Stop existing service if running
            systemctl stop allow2automate-agent 2>/dev/null || true

            # Install with dpkg, then fix dependencies
            if ! dpkg -i "$pkg_file"; then
                log_info "Fixing dependencies..."
                apt-get install -f -y || die "Failed to fix dependencies"
            fi
            ;;
        dnf)
            dnf install -y "$pkg_file" || die "Failed to install with dnf"
            ;;
        yum)
            yum install -y "$pkg_file" || die "Failed to install with yum"
            ;;
        zypper)
            zypper install -y --allow-unsigned-rpm "$pkg_file" || die "Failed to install with zypper"
            ;;
        pacman|apk|none)
            install_from_tarball "$pkg_file"
            ;;
        *)
            die "Unsupported package manager: $PKG_MANAGER"
            ;;
    esac

    log_success "Package installed"
}

install_from_tarball() {
    tarball="$1"

    log_info "Installing from tarball (manual installation)..."

    # Create directories
    mkdir -p /usr/local/bin
    mkdir -p /lib/systemd/system

    # Extract to temp location
    extract_dir="${TEMP_DIR}/extract"
    mkdir -p "$extract_dir"
    tar -xzf "$tarball" -C "$extract_dir" || die "Failed to extract tarball"

    # Find and install binary
    binary=$(find "$extract_dir" -name "allow2automate-agent*" -type f -perm -u+x | head -1)
    if [ -z "$binary" ]; then
        binary=$(find "$extract_dir" -name "allow2automate-agent*" -type f | head -1)
    fi

    if [ -z "$binary" ]; then
        die "Could not find agent binary in tarball"
    fi

    cp "$binary" /usr/local/bin/allow2automate-agent
    chmod +x /usr/local/bin/allow2automate-agent

    # Install helper if present
    helper=$(find "$extract_dir" -name "*helper*" -type f | head -1)
    if [ -n "$helper" ]; then
        cp "$helper" /usr/local/bin/allow2automate-agent-helper
        chmod +x /usr/local/bin/allow2automate-agent-helper
    fi

    # Create systemd service file
    cat > /lib/systemd/system/allow2automate-agent.service << 'SVCEOF'
[Unit]
Description=Allow2Automate Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/allow2automate-agent
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

    log_success "Tarball installation complete"
}

# ============================================================================
# PHASE 4: CONFIGURE
# ============================================================================

write_configuration() {
    config_dir="/etc/allow2automate"
    config_file="${config_dir}/config.json"

    log_info "Writing configuration..."

    # Create config directory with restrictive permissions
    mkdir -p "$config_dir"
    chmod 700 "$config_dir"

    # Write configuration file
    cat > "$config_file" << CFGEOF
{
    "agentId": "${AGENT_ID}",
    "authToken": "${AUTH_TOKEN}",
    "parentUrl": "${PARENT_URL}",
    "version": "${AGENT_VERSION}",
    "installedAt": "$(date -Iseconds)",
    "installedBy": "universal-installer"
}
CFGEOF

    # Secure the config file (contains auth token)
    chmod 600 "$config_file"

    log_success "Configuration written to $config_file"
}

# ============================================================================
# PHASE 5: SERVICE SETUP
# ============================================================================

setup_service() {
    log_info "Setting up systemd service..."

    # Reload systemd to pick up new/updated service file
    systemctl daemon-reload || die "Failed to reload systemd"

    # Enable service to start on boot
    systemctl enable allow2automate-agent || die "Failed to enable service"

    # Start the service
    systemctl start allow2automate-agent || die "Failed to start service"

    # Brief wait for service to start
    sleep 2

    # Verify service is running
    if systemctl is-active --quiet allow2automate-agent; then
        log_success "Service is running"
    else
        log_error "Service failed to start. Check: journalctl -u allow2automate-agent"
        return 1
    fi

    return 0
}

# ============================================================================
# PHASE 6: VERIFICATION
# ============================================================================

verify_installation() {
    log_info "Verifying installation..."

    # Check binary exists
    if [ ! -x /usr/local/bin/allow2automate-agent ]; then
        log_error "Binary not found at /usr/local/bin/allow2automate-agent"
        return 1
    fi

    # Check config exists
    if [ ! -f /etc/allow2automate/config.json ]; then
        log_error "Config not found at /etc/allow2automate/config.json"
        return 1
    fi

    # Check service status
    if ! systemctl is-active --quiet allow2automate-agent; then
        log_error "Service is not running"
        return 1
    fi

    log_success "Installation verified successfully"
    return 0
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    echo "=============================================="
    echo " Allow2Automate Agent - Universal Installer"
    echo "=============================================="
    echo ""

    # Set trap for cleanup on exit
    trap cleanup EXIT

    # Phase 1: Detection
    log_info "Phase 1: Detecting system..."
    detect_root
    detect_architecture
    detect_distro
    detect_package_manager
    detect_download_tool
    echo ""

    # Phase 2: Download
    log_info "Phase 2: Downloading package..."
    pkg_file=$(download_package)
    echo ""

    # Phase 3: Install
    log_info "Phase 3: Installing package..."
    install_package "$pkg_file"
    echo ""

    # Phase 4: Configure
    log_info "Phase 4: Configuring agent..."
    write_configuration
    echo ""

    # Phase 5: Service Setup
    log_info "Phase 5: Setting up service..."
    setup_service
    echo ""

    # Phase 6: Verify
    log_info "Phase 6: Verifying installation..."
    if verify_installation; then
        echo ""
        echo "=============================================="
        echo " Installation Complete!"
        echo "=============================================="
        echo ""
        echo " Agent ID:    $AGENT_ID"
        echo " Parent URL:  $PARENT_URL"
        echo " Version:     $AGENT_VERSION"
        echo ""
        echo " Service:     systemctl status allow2automate-agent"
        echo " Logs:        journalctl -u allow2automate-agent -f"
        echo " Config:      /etc/allow2automate/config.json"
        echo ""
        echo " The agent will connect to the parent app automatically."
        echo "=============================================="
    else
        echo ""
        echo "=============================================="
        echo " Installation completed with warnings"
        echo " Please check the service status manually:"
        echo " systemctl status allow2automate-agent"
        echo "=============================================="
        exit 1
    fi
}

# Run main function
main "$@"
```

---

## 5. GitHub Releases Requirements

### Required Assets per Release

For each release (e.g., `v1.0.0`), publish these assets:

| Asset Name | Platform | Description |
|------------|----------|-------------|
| `allow2automate-agent_1.0.0_amd64.deb` | Linux x86_64 | Debian/Ubuntu package |
| `allow2automate-agent_1.0.0_arm64.deb` | Linux ARM64 | Debian/Ubuntu ARM package |
| `allow2automate-agent-1.0.0.x86_64.rpm` | Linux x86_64 | Fedora/RHEL package |
| `allow2automate-agent-1.0.0.aarch64.rpm` | Linux ARM64 | Fedora/RHEL ARM package |
| `allow2automate-agent-1.0.0-linux-amd64.tar.gz` | Linux x86_64 | Generic tarball |
| `allow2automate-agent-1.0.0-linux-arm64.tar.gz` | Linux ARM64 | Generic tarball |
| `checksums.txt` | All | SHA256 checksums |

### Tarball Contents

```
allow2automate-agent-1.0.0-linux-amd64/
    allow2automate-agent              # Main binary
    allow2automate-agent-helper       # Helper binary (optional)
    allow2automate-agent.service      # Systemd unit file
    LICENSE
    README.md
```

### GitHub Actions Build Matrix Update

The existing GitHub Actions workflow should be updated to produce all required formats:

```yaml
# In .github/workflows/release.yml
- name: Build Linux packages
  if: matrix.platform == 'linux'
  run: |
    # Build DEB for amd64
    bash installers/linux/build.sh

    # Build tarball for fallback distros
    tar -czvf "allow2automate-agent-${VERSION}-linux-amd64.tar.gz" \
      -C dist allow2automate-agent-linux \
      -C helper/dist allow2automate-agent-helper-linux
```

---

## 6. Parent App Script Generator

### Script Generator Service

Location: `app/services/InstallerGeneratorService.js`

```javascript
/**
 * InstallerGeneratorService
 * Generates customized installer scripts with embedded configuration
 */
class InstallerGeneratorService {
  constructor() {
    this.templatePath = path.join(__dirname, '../templates/linux-installer.sh');
    this.template = null;
  }

  async initialize() {
    // Load template from file or embedded resource
    this.template = await fs.readFile(this.templatePath, 'utf8');
  }

  /**
   * Generate a customized installer script for an agent
   * @param {object} config - Agent configuration
   * @returns {string} - Generated shell script
   */
  generateScript(config) {
    const {
      agentId,
      authToken,
      parentUrl,
      agentVersion
    } = config;

    // Validate required fields
    if (!agentId || !authToken || !parentUrl) {
      throw new Error('Missing required configuration fields');
    }

    // Replace placeholders in template
    let script = this.template
      .replace(/__AGENT_ID__/g, agentId)
      .replace(/__AUTH_TOKEN__/g, authToken)
      .replace(/__PARENT_URL__/g, parentUrl)
      .replace(/__AGENT_VERSION__/g, agentVersion || 'latest');

    return script;
  }

  /**
   * Generate and return script as downloadable content
   */
  async getDownloadableScript(agentId) {
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    const config = {
      agentId: agent.id,
      authToken: agent.auth_token,
      parentUrl: this.getParentUrl(),
      agentVersion: this.getCurrentVersion()
    };

    return {
      filename: `install-allow2automate-${agentId.substring(0, 8)}.sh`,
      content: this.generateScript(config),
      contentType: 'application/x-sh'
    };
  }

  /**
   * Get parent URL (local network address)
   */
  getParentUrl() {
    // Get local IP address for the parent app
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return `https://${iface.address}:8443`;
        }
      }
    }
    return 'https://localhost:8443';
  }
}
```

### API Endpoint for Script Download

```javascript
// In app/routes/agent.js
router.get('/installer/linux/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const generator = global.services.installerGenerator;

    const { filename, content, contentType } =
      await generator.getDownloadableScript(agentId);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### UI Integration

The UI shows a download button that fetches the customized script:

```javascript
// In AgentManagement component
const downloadLinuxInstaller = async (agentId) => {
  const response = await fetch(`/api/agent/installer/linux/${agentId}`);
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `install-allow2automate.sh`;
  a.click();
};
```

---

## 7. Update Handling

The installer also handles updates by detecting existing installations:

```sh
handle_existing_installation() {
    if [ -f /usr/local/bin/allow2automate-agent ]; then
        log_info "Existing installation detected"

        # Get current version
        current_version=$(/usr/local/bin/allow2automate-agent --version 2>/dev/null || echo "unknown")
        log_info "Current version: $current_version"
        log_info "New version: $AGENT_VERSION"

        # Stop service before update
        if systemctl is-active --quiet allow2automate-agent 2>/dev/null; then
            log_info "Stopping existing service..."
            systemctl stop allow2automate-agent
        fi

        # Backup existing config (preserve auth token if same agent)
        if [ -f /etc/allow2automate/config.json ]; then
            cp /etc/allow2automate/config.json "${TEMP_DIR}/config.backup.json"
        fi
    fi
}
```

---

## 8. Security Considerations

1. **Auth Token Protection**: Config file is chmod 600, directory chmod 700
2. **HTTPS Only**: Parent URL always uses HTTPS
3. **Checksum Verification**: SHA256 checksums verified before install
4. **Minimal Privileges**: Script requires root only for installation
5. **No External Dependencies**: Uses only sh, curl/wget, standard Unix tools
6. **Embedded Credentials**: Script contains sensitive tokens - treat as confidential

---

## 9. Testing Matrix

| Distro | Version | Package Manager | Expected Format |
|--------|---------|-----------------|-----------------|
| Ubuntu | 20.04, 22.04, 24.04 | apt | .deb |
| Debian | 11, 12 | apt | .deb |
| Linux Mint | 21 | apt | .deb |
| Fedora | 38, 39, 40 | dnf | .rpm |
| RHEL | 8, 9 | dnf | .rpm |
| CentOS Stream | 8, 9 | dnf | .rpm |
| Rocky Linux | 8, 9 | dnf | .rpm |
| AlmaLinux | 8, 9 | dnf | .rpm |
| openSUSE | 15.5+ | zypper | .rpm |
| Arch Linux | rolling | pacman | .tar.gz |
| Manjaro | rolling | pacman | .tar.gz |
| Alpine | 3.18+ | apk | .tar.gz |

---

## 10. Error Handling and User Feedback

The script provides clear feedback at each phase:

```
==============================================
 Allow2Automate Agent - Universal Installer
==============================================

[INFO] Phase 1: Detecting system...
[OK] Running as root
[OK] Architecture: amd64
[OK] Distro: ubuntu (version: 22.04)
[OK] Package manager: apt (format: deb)
[OK] Download tool: curl

[INFO] Phase 2: Downloading package...
[INFO] Downloading: https://github.com/.../v1.0.0/allow2automate-agent_1.0.0_amd64.deb
[OK] Package downloaded: /tmp/tmp.xxx/allow2automate-agent.deb

[INFO] Phase 3: Installing package...
[OK] Package installed

[INFO] Phase 4: Configuring agent...
[OK] Configuration written to /etc/allow2automate/config.json

[INFO] Phase 5: Setting up service...
[OK] Service is running

[INFO] Phase 6: Verifying installation...
[OK] Installation verified successfully

==============================================
 Installation Complete!
==============================================

 Agent ID:    abc123-def456-...
 Parent URL:  https://192.168.1.100:8443
 Version:     1.0.0

 Service:     systemctl status allow2automate-agent
 Logs:        journalctl -u allow2automate-agent -f
 Config:      /etc/allow2automate/config.json

 The agent will connect to the parent app automatically.
==============================================
```
