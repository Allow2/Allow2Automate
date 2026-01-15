# Home Assistant Integration Research for allow2homeassistant

**Research Date:** January 15, 2026
**Purpose:** Inform the design and implementation of the allow2homeassistant plugin integration

---

## Executive Summary

This research document analyzes Home Assistant integration patterns, authentication methods, and configuration approaches to guide the development of the allow2homeassistant plugin. The plugin will integrate the Allow2 Parental Freedom platform with Home Assistant, enabling parents to control smart home devices based on children's activities and quotas.

**Recommended Approach:** Custom HACS-compatible integration with config flow UI, using cloud_polling IoT class with sensor and switch platforms.

---

## Table of Contents

1. [Home Assistant Integration Types](#1-home-assistant-integration-types)
2. [API-Based Integration Patterns](#2-api-based-integration-patterns)
3. [Authentication and Configuration](#3-authentication-and-configuration)
4. [Allow2 Ecosystem Analysis](#4-allow2-ecosystem-analysis)
5. [Architecture Recommendations](#5-architecture-recommendations)
6. [Implementation Roadmap](#6-implementation-roadmap)

---

## 1. Home Assistant Integration Types

### 1.1 Custom Integrations (HACS)

**Overview:**
- Custom integrations live in `<config_dir>/custom_components/<domain>`
- HACS (Home Assistant Community Store) simplifies installation and updates
- Must include `version` key in manifest.json
- Requires proper directory structure and metadata files

**Key Files Required:**
```
custom_components/allow2/
├── __init__.py          # Integration initialization
├── manifest.json        # Integration metadata
├── config_flow.py       # UI configuration handler
├── sensor.py            # Sensor platform (optional)
├── switch.py            # Switch platform (optional)
├── const.py             # Constants and configuration
└── strings.json         # Translation strings
```

**HACS Compatibility Requirements:**
- Valid semantic versioning (SemVer) in manifest.json
- GitHub repository with proper structure
- Optional hacs.json file for additional metadata
- README.md with installation and usage instructions

### 1.2 Integration Components

**Platform Types Available:**
- **Sensor Platform:** Read-only data (time remaining, quota status)
- **Switch Platform:** On/off control (enable/disable device access)
- **Binary Sensor:** Boolean states (allowed/blocked)
- **Service Calls:** Custom actions (check activity, add bonus time)

**Best Practices:**
- Use async methods for all I/O operations
- Implement proper error handling and logging
- Support configuration via UI (config flow)
- Provide meaningful entity names and IDs
- Include proper device classes and units

### 1.3 Integration Manifest Structure

**Complete manifest.json Example:**
```json
{
  "domain": "allow2",
  "name": "Allow2 Parental Freedom",
  "version": "1.0.0",
  "documentation": "https://github.com/yourusername/allow2homeassistant",
  "issue_tracker": "https://github.com/yourusername/allow2homeassistant/issues",
  "dependencies": [],
  "codeowners": ["@yourusername"],
  "requirements": ["aiohttp>=3.8.0"],
  "config_flow": true,
  "iot_class": "cloud_polling",
  "integration_type": "service"
}
```

**Key Fields Explained:**
- **domain:** Unique identifier (lowercase with underscores)
- **name:** Human-readable display name
- **version:** Semantic version (required for custom integrations)
- **config_flow:** Set to `true` to enable UI configuration
- **iot_class:** Communication method classification
- **integration_type:** Type of integration (hub, device, service, etc.)
- **requirements:** Python package dependencies

### 1.4 IoT Class Classifications

**Available Options:**

| IoT Class | Description | Internet Required | Update Method |
|-----------|-------------|-------------------|---------------|
| `cloud_polling` | Cloud API with polling | Yes | Periodic checks |
| `cloud_push` | Cloud API with push notifications | Yes | Real-time |
| `local_polling` | Local device with polling | No | Periodic checks |
| `local_push` | Local device with push | No | Real-time |
| `calculated` | Computed values | N/A | On-demand |
| `assumed_state` | Cannot verify state | Varies | Assumed |

**Recommendation for allow2:** Use `cloud_polling` as the integration communicates with Allow2's cloud API and checks permissions periodically.

---

## 2. API-Based Integration Patterns

### 2.1 IFTTT Integration Pattern

**Architecture:**
- Uses webhook-based communication
- Triggers sent via HTTP POST to IFTTT webhooks
- Events received from IFTTT fire as `ifttt_webhook_received` events
- Requires external URL or Nabu Casa Cloud subscription

**Key Characteristics:**
- Simple webhook integration
- No complex API library required
- Event-driven architecture
- Requires publicly accessible endpoint for incoming webhooks

**Code Pattern:**
```python
# Outgoing webhook to IFTTT
await hass.services.async_call(
    "ifttt", "trigger",
    {"event": "test_event", "value1": "Hello World"}
)

# Incoming webhook handler
@callback
def handle_webhook(hass, webhook_id, request):
    """Handle webhook callback."""
    data = await request.json()
    hass.bus.async_fire("ifttt_webhook_received", data)
```

### 2.2 SmartThings Integration Pattern

**Architecture:**
- Uses REST API with OAuth2 authentication
- Maps device capabilities to Home Assistant entities
- Supports bi-directional communication
- Personal Access Token (PAT) authentication (being deprecated)

**Key Characteristics:**
- Complex capability-to-entity mapping
- Real-time device state synchronization
- Requires API token management
- Support for multiple device types

**Authentication Flow:**
1. User provides Personal Access Token
2. Token stored in config entry
3. API client initialized with token
4. Periodic token validation

### 2.3 Common Integration Patterns

**Best Practices Observed:**

1. **API Client Library:**
   - Separate API logic from Home Assistant integration
   - Use async HTTP clients (aiohttp)
   - Implement proper error handling and retries
   - Support connection pooling

2. **State Management:**
   - Poll API periodically for state updates
   - Cache responses to reduce API calls
   - Implement exponential backoff on errors
   - Use coordinator pattern for multiple entities

3. **Entity Updates:**
   - Use DataUpdateCoordinator for efficient polling
   - Batch API requests when possible
   - Update multiple entities from single API call
   - Implement proper state restoration

**Example DataUpdateCoordinator:**
```python
class Allow2DataUpdateCoordinator(DataUpdateCoordinator):
    """Class to manage fetching Allow2 data."""

    def __init__(self, hass: HomeAssistant, api_client):
        """Initialize."""
        super().__init__(
            hass,
            _LOGGER,
            name="Allow2",
            update_interval=timedelta(minutes=5),
        )
        self.api_client = api_client

    async def _async_update_data(self):
        """Fetch data from API."""
        try:
            return await self.api_client.check_activities()
        except Exception as err:
            raise UpdateFailed(f"Error communicating with API: {err}")
```

---

## 3. Authentication and Configuration

### 3.1 Config Flow Pattern

**Overview:**
Config flow provides UI-based configuration in Home Assistant. Users configure integrations through Settings > Devices & Services > Add Integration.

**Basic Config Flow Structure:**
```python
from homeassistant import config_entries
from homeassistant.core import callback
import voluptuous as vol

class Allow2ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Allow2."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        errors = {}

        if user_input is not None:
            # Validate credentials
            try:
                info = await validate_credentials(
                    user_input["username"],
                    user_input["password"],
                    user_input["device_token"]
                )

                # Create unique ID to prevent duplicates
                await self.async_set_unique_id(info["user_id"])
                self._abort_if_unique_id_configured()

                # Create config entry
                return self.async_create_entry(
                    title=f"Allow2 ({user_input['username']})",
                    data=user_input
                )
            except CannotConnect:
                errors["base"] = "cannot_connect"
            except InvalidAuth:
                errors["base"] = "invalid_auth"

        # Show configuration form
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required("username"): str,
                vol.Required("password"): str,
                vol.Required("device_token"): str,
            }),
            errors=errors,
        )
```

### 3.2 Credential Storage

**Config Entry Data Structure:**
- Credentials stored in `.storage/core.config_entries`
- Data stored as JSON (not encrypted by default)
- Accessed via `entry.data` dictionary

**Important Security Note:**
- Home Assistant does NOT encrypt stored credentials
- `secrets.yaml` is also stored in plain text
- Physical security of the Home Assistant instance is critical
- Consider additional encryption for sensitive deployments

**Storage Best Practices:**
```python
# Store sensitive data in config entry data (not options)
entry.data = {
    "username": user_input["username"],
    "password": user_input["password"],  # Plain text!
    "device_token": user_input["device_token"],
    "pair_id": pair_response["pairId"],
    "pair_token": pair_response["pairToken"],
    "user_id": pair_response["userId"],
}

# Options for user-configurable settings (not credentials)
entry.options = {
    "scan_interval": 300,  # 5 minutes
    "children": ["child1_id", "child2_id"],
}
```

### 3.3 Secrets Management Alternatives

**Options for Enhanced Security:**

1. **secrets.yaml (Standard):**
   - Store API keys separate from configuration.yaml
   - Reference with `!secret` syntax
   - Not encrypted, but isolated

2. **Environment Variables:**
   - Store credentials as environment variables
   - Access via `os.environ`
   - Better for containerized deployments

3. **External Secret Management:**
   - Use external services (Vault, AWS Secrets Manager)
   - Requires custom integration code
   - Best for enterprise deployments

**Example secrets.yaml:**
```yaml
# secrets.yaml
allow2_username: user@example.com
allow2_password: SecurePassword123
allow2_device_token: dev_abc123xyz
```

---

## 4. Allow2 Ecosystem Analysis

### 4.1 Allow2 API Architecture

**API Endpoints:**

1. **Device Pairing:**
   - **Endpoint:** `https://api.allow2.com/api/pairDevice`
   - **Method:** POST
   - **Purpose:** Register device and obtain credentials

2. **Activity Check:**
   - **Endpoint:** `https://service.allow2.com/serviceapi/check`
   - **Method:** POST
   - **Purpose:** Check if activity is allowed and log usage

**Authentication Flow:**

```
1. Pairing Request
   ↓
   POST /api/pairDevice
   {
     "user": "email@example.com",
     "pass": "password",
     "deviceToken": "unique_device_id",
     "name": "Home Assistant"
   }
   ↓
2. Pairing Response
   {
     "userId": 12345,
     "pairId": "ABC123",
     "pairToken": "token_xyz",
     "children": [...]
   }
   ↓
3. Store Credentials
   ↓
4. Activity Check Requests
   POST /serviceapi/check
   {
     "userId": 12345,
     "pairId": "ABC123",
     "pairToken": "token_xyz",
     "deviceToken": "unique_device_id",
     "tz": "America/New_York",
     "childId": 1,
     "activities": [{"id": 3, "log": true}]
   }
   ↓
5. Check Response
   {
     "allowed": true,
     "activities": [...],
     "dayTypes": [...],
     "children": [...]
   }
```

### 4.2 Allow2 Activity Types

**Standard Activities:**

| ID | Activity | Description |
|----|----------|-------------|
| 1 | Internet | General internet access |
| 2 | Computer | Computer usage time |
| 3 | Gaming | Gaming console/PC gaming |
| 4 | Electricity | Power quotas for devices |
| 5 | Screen Time | General screen usage |
| 6 | Social | Social media access |
| 7 | Phone Time | Mobile phone usage |

**Custom Activities:**
- Parents can define custom activities
- Each activity has configurable quotas and restrictions
- Activities can be combined in a single check request

### 4.3 allow2nodered Package Analysis

**Package Details:**
- **Name:** allow2nodered
- **Version:** 0.9.1
- **License:** MIT
- **Repository:** https://github.com/Allow2/Allow2NodeRED

**Architecture:**

```javascript
// Node-RED node structure
module.exports = function(RED) {
    function Allow2CheckNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.on('input', function(msg) {
            // Extract configuration
            const activities = config.activities || msg.activities;
            const childId = config.childId || msg.childId;

            // Call Allow2 API
            checkActivities({
                userId: credentials.userId,
                pairId: credentials.pairId,
                pairToken: credentials.pairToken,
                deviceToken: credentials.deviceToken,
                childId: childId,
                activities: activities
            }).then(response => {
                // Return result
                msg.payload = response;
                node.send(msg);
            }).catch(err => {
                node.error("Allow2 check failed: " + err);
            });
        });
    }

    RED.nodes.registerType("allow2-check", Allow2CheckNode);
}
```

**Key Patterns to Reuse:**
1. **Pairing Configuration:** Store credentials in config node
2. **Activity Checking:** Wrap API call in async function
3. **Error Handling:** Graceful degradation on API errors
4. **Response Format:** Return structured JSON with all relevant data

### 4.4 Allow2 Response Structure

**Example Check Response:**
```json
{
  "allowed": true,
  "activities": [
    {
      "id": 3,
      "name": "Gaming",
      "units": "time",
      "timeUsedToday": 3600,
      "timeAllowedToday": 7200,
      "timeRemaining": 3600,
      "timed": true,
      "banned": false
    }
  ],
  "dayTypes": [
    {
      "id": 1,
      "name": "School Day",
      "fromTime": "15:00",
      "toTime": "20:00"
    }
  ],
  "children": [
    {
      "id": 1,
      "name": "Child Name",
      "timezone": "America/New_York"
    }
  ]
}
```

**Key Data Points:**
- **allowed:** Boolean indicating if activity is permitted
- **timeRemaining:** Seconds of quota remaining
- **banned:** If activity is completely blocked
- **dayTypes:** Context about current restrictions

---

## 5. Architecture Recommendations

### 5.1 Recommended Integration Structure

**Directory Layout:**
```
custom_components/allow2/
├── __init__.py              # Integration setup
├── manifest.json            # Integration metadata
├── config_flow.py           # UI configuration
├── const.py                 # Constants
├── coordinator.py           # Data update coordinator
├── api.py                   # Allow2 API client
├── sensor.py                # Sensor entities
├── switch.py                # Switch entities
├── services.yaml            # Service definitions
├── strings.json             # UI strings
└── translations/
    └── en.json             # English translations
```

### 5.2 Core Components

#### 5.2.1 API Client (api.py)

```python
"""Allow2 API Client."""
import aiohttp
import logging
from typing import Dict, List, Optional

_LOGGER = logging.getLogger(__name__)

API_BASE_URL = "https://api.allow2.com"
SERVICE_BASE_URL = "https://service.allow2.com"

class Allow2ApiClient:
    """Client for Allow2 API."""

    def __init__(
        self,
        session: aiohttp.ClientSession,
        device_token: str,
        pair_id: Optional[str] = None,
        pair_token: Optional[str] = None,
        user_id: Optional[int] = None,
    ):
        """Initialize the API client."""
        self._session = session
        self._device_token = device_token
        self._pair_id = pair_id
        self._pair_token = pair_token
        self._user_id = user_id

    async def pair_device(
        self, username: str, password: str, device_name: str
    ) -> Dict:
        """Pair device with Allow2 account."""
        url = f"{API_BASE_URL}/api/pairDevice"
        data = {
            "user": username,
            "pass": password,
            "deviceToken": self._device_token,
            "name": device_name,
        }

        async with self._session.post(url, json=data) as response:
            response.raise_for_status()
            result = await response.json()

            # Store credentials
            self._user_id = result["userId"]
            self._pair_id = result["pairId"]
            self._pair_token = result["pairToken"]

            return result

    async def check_activities(
        self,
        child_id: int,
        activities: List[Dict],
        timezone: str = "UTC",
    ) -> Dict:
        """Check if activities are allowed."""
        if not all([self._user_id, self._pair_id, self._pair_token]):
            raise ValueError("Device not paired")

        url = f"{SERVICE_BASE_URL}/serviceapi/check"
        data = {
            "userId": self._user_id,
            "pairId": self._pair_id,
            "pairToken": self._pair_token,
            "deviceToken": self._device_token,
            "tz": timezone,
            "childId": child_id,
            "activities": activities,
        }

        async with self._session.post(url, json=data) as response:
            response.raise_for_status()
            return await response.json()

    async def get_children(self) -> List[Dict]:
        """Get list of children from account."""
        # Check activities without logging to get child list
        result = await self.check_activities(
            child_id=0,  # Special ID to get all children
            activities=[],
        )
        return result.get("children", [])
```

#### 5.2.2 Data Update Coordinator (coordinator.py)

```python
"""Allow2 Data Update Coordinator."""
from datetime import timedelta
import logging

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import (
    DataUpdateCoordinator,
    UpdateFailed,
)

from .api import Allow2ApiClient
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

class Allow2DataUpdateCoordinator(DataUpdateCoordinator):
    """Class to manage fetching Allow2 data."""

    def __init__(
        self,
        hass: HomeAssistant,
        api_client: Allow2ApiClient,
        update_interval: int = 300,
    ):
        """Initialize."""
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=update_interval),
        )
        self.api_client = api_client
        self.children = []
        self.activities = []

    async def _async_update_data(self):
        """Fetch data from API."""
        try:
            # Get children list
            if not self.children:
                self.children = await self.api_client.get_children()

            # Check activities for each child
            data = {}
            for child in self.children:
                child_id = child["id"]

                # Check all activities for this child
                result = await self.api_client.check_activities(
                    child_id=child_id,
                    activities=[
                        {"id": i, "log": False}
                        for i in range(1, 8)  # Activities 1-7
                    ],
                    timezone=child.get("timezone", "UTC"),
                )

                data[child_id] = result

            return data

        except Exception as err:
            raise UpdateFailed(f"Error communicating with API: {err}")
```

#### 5.2.3 Sensor Platform (sensor.py)

```python
"""Allow2 Sensor Platform."""
from homeassistant.components.sensor import (
    SensorEntity,
    SensorDeviceClass,
    SensorStateClass,
)
from homeassistant.const import UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import Allow2DataUpdateCoordinator

ACTIVITY_NAMES = {
    1: "Internet",
    2: "Computer",
    3: "Gaming",
    4: "Electricity",
    5: "Screen Time",
    6: "Social",
    7: "Phone Time",
}

async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Allow2 sensor platform."""
    coordinator: Allow2DataUpdateCoordinator = hass.data[DOMAIN][entry.entry_id]

    entities = []

    # Create sensors for each child and activity
    for child_id, child_data in coordinator.data.items():
        child_name = next(
            (c["name"] for c in coordinator.children if c["id"] == child_id),
            f"Child {child_id}",
        )

        for activity in child_data.get("activities", []):
            entities.append(
                Allow2ActivitySensor(
                    coordinator,
                    child_id,
                    child_name,
                    activity["id"],
                )
            )

    async_add_entities(entities)

class Allow2ActivitySensor(CoordinatorEntity, SensorEntity):
    """Representation of an Allow2 Activity Sensor."""

    def __init__(
        self,
        coordinator: Allow2DataUpdateCoordinator,
        child_id: int,
        child_name: str,
        activity_id: int,
    ):
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._child_id = child_id
        self._child_name = child_name
        self._activity_id = activity_id
        self._activity_name = ACTIVITY_NAMES.get(activity_id, f"Activity {activity_id}")

        # Entity attributes
        self._attr_name = f"{child_name} {self._activity_name} Time Remaining"
        self._attr_unique_id = f"allow2_{child_id}_activity_{activity_id}"
        self._attr_device_class = SensorDeviceClass.DURATION
        self._attr_state_class = SensorStateClass.MEASUREMENT
        self._attr_native_unit_of_measurement = UnitOfTime.SECONDS

    @property
    def native_value(self):
        """Return the state of the sensor."""
        child_data = self.coordinator.data.get(self._child_id, {})
        activities = child_data.get("activities", [])

        for activity in activities:
            if activity["id"] == self._activity_id:
                return activity.get("timeRemaining", 0)

        return 0

    @property
    def extra_state_attributes(self):
        """Return additional attributes."""
        child_data = self.coordinator.data.get(self._child_id, {})
        activities = child_data.get("activities", [])

        for activity in activities:
            if activity["id"] == self._activity_id:
                return {
                    "allowed": child_data.get("allowed", False),
                    "time_used_today": activity.get("timeUsedToday", 0),
                    "time_allowed_today": activity.get("timeAllowedToday", 0),
                    "banned": activity.get("banned", False),
                    "timed": activity.get("timed", False),
                }

        return {}
```

#### 5.2.4 Switch Platform (switch.py)

```python
"""Allow2 Switch Platform."""
from homeassistant.components.switch import SwitchEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import Allow2DataUpdateCoordinator

async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Allow2 switch platform."""
    coordinator: Allow2DataUpdateCoordinator = hass.data[DOMAIN][entry.entry_id]

    entities = []

    # Create a master switch for each child
    for child in coordinator.children:
        entities.append(
            Allow2ChildSwitch(
                coordinator,
                child["id"],
                child["name"],
            )
        )

    async_add_entities(entities)

class Allow2ChildSwitch(CoordinatorEntity, SwitchEntity):
    """Representation of an Allow2 Child Control Switch."""

    def __init__(
        self,
        coordinator: Allow2DataUpdateCoordinator,
        child_id: int,
        child_name: str,
    ):
        """Initialize the switch."""
        super().__init__(coordinator)
        self._child_id = child_id
        self._child_name = child_name

        # Entity attributes
        self._attr_name = f"{child_name} Device Access"
        self._attr_unique_id = f"allow2_{child_id}_access"

    @property
    def is_on(self):
        """Return true if access is allowed."""
        child_data = self.coordinator.data.get(self._child_id, {})
        return child_data.get("allowed", False)

    async def async_turn_on(self, **kwargs):
        """Enable device access (add bonus time)."""
        # This would call Allow2 API to add bonus time
        # Implementation depends on Allow2 API capabilities
        pass

    async def async_turn_off(self, **kwargs):
        """Disable device access."""
        # This would need to modify quotas via Allow2 API
        # May not be supported by current API
        pass
```

### 5.3 Integration Initialization (__init__.py)

```python
"""The Allow2 integration."""
import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import Allow2ApiClient
from .const import DOMAIN
from .coordinator import Allow2DataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.SENSOR, Platform.SWITCH]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Allow2 from a config entry."""

    # Create API client
    session = async_get_clientsession(hass)
    api_client = Allow2ApiClient(
        session=session,
        device_token=entry.data["device_token"],
        pair_id=entry.data["pair_id"],
        pair_token=entry.data["pair_token"],
        user_id=entry.data["user_id"],
    )

    # Create data update coordinator
    coordinator = Allow2DataUpdateCoordinator(
        hass,
        api_client,
        update_interval=entry.options.get("scan_interval", 300),
    )

    # Fetch initial data
    await coordinator.async_config_entry_first_refresh()

    # Store coordinator
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator

    # Forward entry setup to platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)

    return unload_ok
```

### 5.4 Configuration UI (config_flow.py)

```python
"""Config flow for Allow2 integration."""
import logging
import uuid
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
import homeassistant.helpers.config_validation as cv

from .api import Allow2ApiClient
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

class Allow2ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Allow2."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        errors = {}

        if user_input is not None:
            # Generate unique device token
            device_token = user_input.get("device_token") or str(uuid.uuid4())

            # Validate and pair device
            try:
                session = async_get_clientsession(self.hass)
                api_client = Allow2ApiClient(session, device_token)

                pair_result = await api_client.pair_device(
                    username=user_input["username"],
                    password=user_input["password"],
                    device_name=user_input.get("device_name", "Home Assistant"),
                )

                # Set unique ID based on user ID
                await self.async_set_unique_id(str(pair_result["userId"]))
                self._abort_if_unique_id_configured()

                # Create config entry
                return self.async_create_entry(
                    title=f"Allow2 ({user_input['username']})",
                    data={
                        "username": user_input["username"],
                        "password": user_input["password"],
                        "device_token": device_token,
                        "pair_id": pair_result["pairId"],
                        "pair_token": pair_result["pairToken"],
                        "user_id": pair_result["userId"],
                    },
                )

            except Exception as err:
                _LOGGER.exception("Error pairing device: %s", err)
                errors["base"] = "cannot_connect"

        # Show form
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required("username"): str,
                vol.Required("password"): str,
                vol.Optional("device_name", default="Home Assistant"): str,
                vol.Optional("device_token"): str,
            }),
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Get the options flow."""
        return Allow2OptionsFlowHandler(config_entry)

class Allow2OptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options."""

    def __init__(self, config_entry):
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        """Manage options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Optional(
                    "scan_interval",
                    default=self.config_entry.options.get("scan_interval", 300),
                ): cv.positive_int,
            }),
        )
```

### 5.5 Constants (const.py)

```python
"""Constants for Allow2 integration."""

DOMAIN = "allow2"

# API Configuration
API_BASE_URL = "https://api.allow2.com"
SERVICE_BASE_URL = "https://service.allow2.com"
DEFAULT_SCAN_INTERVAL = 300  # 5 minutes

# Activity IDs
ACTIVITY_INTERNET = 1
ACTIVITY_COMPUTER = 2
ACTIVITY_GAMING = 3
ACTIVITY_ELECTRICITY = 4
ACTIVITY_SCREEN_TIME = 5
ACTIVITY_SOCIAL = 6
ACTIVITY_PHONE_TIME = 7

ACTIVITY_NAMES = {
    ACTIVITY_INTERNET: "Internet",
    ACTIVITY_COMPUTER: "Computer",
    ACTIVITY_GAMING: "Gaming",
    ACTIVITY_ELECTRICITY: "Electricity",
    ACTIVITY_SCREEN_TIME: "Screen Time",
    ACTIVITY_SOCIAL: "Social",
    ACTIVITY_PHONE_TIME: "Phone Time",
}
```

---

## 6. Implementation Roadmap

### Phase 1: Basic Integration (Week 1-2)

**Tasks:**
1. Create integration directory structure
2. Implement manifest.json with proper metadata
3. Create basic __init__.py with setup/unload
4. Implement API client (api.py) with pairing and check methods
5. Create config flow for UI-based setup
6. Basic error handling and logging

**Deliverables:**
- Working integration that can be added via UI
- Successful pairing with Allow2 account
- Basic API communication established

### Phase 2: Sensor Platform (Week 2-3)

**Tasks:**
1. Implement DataUpdateCoordinator for efficient polling
2. Create sensor entities for each child/activity combination
3. Display time remaining for each activity
4. Add extra attributes (time used, allowed, banned status)
5. Implement proper state restoration
6. Add device info for grouping entities

**Deliverables:**
- Sensor entities showing activity status
- Automatic updates every 5 minutes
- Proper entity naming and organization

### Phase 3: Switch Platform (Week 3-4)

**Tasks:**
1. Create switch entities for device access control
2. Implement turn_on/turn_off actions (if API supports)
3. Reflect current allowed status
4. Add icons and device classes
5. Integrate with Home Assistant automation system

**Deliverables:**
- Switch entities for each child
- Integration with automation rules
- Visual indicators in UI

### Phase 4: Advanced Features (Week 4-5)

**Tasks:**
1. Add service calls (add_bonus_time, check_activity)
2. Implement options flow for scan interval configuration
3. Add support for custom activities
4. Create comprehensive error handling
5. Implement retry logic with exponential backoff
6. Add diagnostic sensors (API status, last update)

**Deliverables:**
- Service calls available in automations
- Configurable update intervals
- Robust error handling

### Phase 5: HACS Integration (Week 5-6)

**Tasks:**
1. Create GitHub repository with proper structure
2. Add comprehensive README.md
3. Create hacs.json file
4. Add example automations
5. Write installation instructions
6. Create issue templates
7. Add CI/CD for validation

**Deliverables:**
- HACS-compatible repository
- Complete documentation
- Example configurations

### Phase 6: Testing & Polish (Week 6-7)

**Tasks:**
1. Write unit tests for API client
2. Create integration tests
3. Test with multiple children and activities
4. Performance testing and optimization
5. Security review
6. Translation support (strings.json)
7. Beta testing with users

**Deliverables:**
- Test coverage > 80%
- Performance optimizations
- Multi-language support

### Phase 7: Release (Week 7-8)

**Tasks:**
1. Create release notes
2. Tag version 1.0.0
3. Submit to HACS default repository
4. Announce in Home Assistant community
5. Create video tutorial
6. Monitor for issues and feedback

**Deliverables:**
- Public release on HACS
- Community announcement
- Support infrastructure

---

## 7. Similar Integration Examples

### 7.1 Nintendo Switch Parental Controls

**Official Home Assistant Integration**

**Key Features:**
- Monitor screen time usage
- Set maximum screen time limits
- Automatic software suspension on bedtime
- Bonus time service call
- Configuration via UI

**Architecture Lessons:**
- Simple sensor platform for time tracking
- Service call for adding bonus time
- Clear entity naming convention
- Proper device class usage

**Code Reference:**
```python
# Service call pattern
async def add_bonus_time(call):
    """Add bonus time to device."""
    device_id = call.data.get("device_id")
    minutes = call.data.get("minutes")

    await api.add_bonus_time(device_id, minutes)
    await coordinator.async_request_refresh()

hass.services.async_register(
    DOMAIN,
    "add_bonus_time",
    add_bonus_time,
    schema=vol.Schema({
        vol.Required("device_id"): cv.string,
        vol.Required("minutes"): cv.positive_int,
    }),
)
```

### 7.2 Google Family Link Integration

**Custom HACS Integration**

**Key Features:**
- Control and monitor children's devices
- Get device location
- Lock/unlock devices
- App usage monitoring

**Architecture Lessons:**
- Multiple platform support (sensor, switch, device_tracker)
- Complex API authentication with OAuth
- Real-time state updates
- Device registry integration

**Applicable Patterns:**
- Device grouping per child
- Multiple entity types per device
- Service calls for control actions

---

## 8. Security Considerations

### 8.1 Credential Storage

**Risks:**
- Credentials stored in plain text in `.storage/core.config_entries`
- Physical access to Home Assistant server = full credential access
- No built-in encryption for config entries

**Mitigation Strategies:**
1. Educate users about physical security
2. Recommend encrypted file system (LUKS)
3. Consider implementing custom encryption layer
4. Use secure communication (HTTPS only)
5. Implement token refresh if Allow2 API supports it

### 8.2 API Communication

**Security Best Practices:**
- Always use HTTPS for API calls
- Validate SSL certificates
- Implement request timeout
- Rate limiting to prevent API abuse
- Log security-relevant events
- Sanitize error messages (don't expose credentials)

**Example Secure API Client:**
```python
async def _make_request(self, method, url, **kwargs):
    """Make secure API request."""
    try:
        # Set timeout
        timeout = aiohttp.ClientTimeout(total=30)

        # Ensure HTTPS
        if not url.startswith("https://"):
            raise ValueError("Only HTTPS URLs allowed")

        async with self._session.request(
            method, url, timeout=timeout, **kwargs
        ) as response:
            # Log request (without sensitive data)
            _LOGGER.debug(
                "API request: %s %s - Status: %d",
                method,
                url,
                response.status,
            )

            response.raise_for_status()
            return await response.json()

    except aiohttp.ClientError as err:
        # Log error without exposing credentials
        _LOGGER.error("API request failed: %s", err)
        raise
```

### 8.3 User Education

**Documentation Must Include:**
1. Warning about plain text credential storage
2. Recommendation for system-level encryption
3. Importance of securing Home Assistant instance
4. Regular password rotation best practices
5. Network security considerations

---

## 9. Testing Strategy

### 9.1 Unit Tests

**API Client Tests:**
```python
"""Test Allow2 API Client."""
import pytest
from aiohttp import ClientSession
from unittest.mock import AsyncMock, patch

from custom_components.allow2.api import Allow2ApiClient

@pytest.mark.asyncio
async def test_pair_device_success():
    """Test successful device pairing."""
    session = AsyncMock(spec=ClientSession)
    client = Allow2ApiClient(session, "device_token_123")

    # Mock response
    mock_response = {
        "userId": 12345,
        "pairId": "ABC123",
        "pairToken": "token_xyz",
        "children": [],
    }

    with patch.object(session, "post") as mock_post:
        mock_post.return_value.__aenter__.return_value.json = AsyncMock(
            return_value=mock_response
        )

        result = await client.pair_device(
            "user@example.com",
            "password",
            "Home Assistant"
        )

        assert result["userId"] == 12345
        assert client._pair_id == "ABC123"

@pytest.mark.asyncio
async def test_check_activities():
    """Test activity checking."""
    session = AsyncMock(spec=ClientSession)
    client = Allow2ApiClient(
        session,
        "device_token_123",
        pair_id="ABC123",
        pair_token="token_xyz",
        user_id=12345,
    )

    mock_response = {
        "allowed": True,
        "activities": [
            {
                "id": 3,
                "timeRemaining": 3600,
                "timeUsedToday": 1800,
            }
        ],
    }

    with patch.object(session, "post") as mock_post:
        mock_post.return_value.__aenter__.return_value.json = AsyncMock(
            return_value=mock_response
        )

        result = await client.check_activities(
            child_id=1,
            activities=[{"id": 3, "log": False}],
        )

        assert result["allowed"] is True
        assert len(result["activities"]) == 1
```

### 9.2 Integration Tests

**Config Flow Tests:**
```python
"""Test Allow2 config flow."""
from unittest.mock import patch

from homeassistant import config_entries
from homeassistant.core import HomeAssistant

from custom_components.allow2.const import DOMAIN

async def test_user_flow_success(hass: HomeAssistant):
    """Test successful user config flow."""
    with patch(
        "custom_components.allow2.config_flow.Allow2ApiClient.pair_device",
        return_value={
            "userId": 12345,
            "pairId": "ABC123",
            "pairToken": "token_xyz",
            "children": [],
        },
    ):
        result = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": config_entries.SOURCE_USER}
        )

        assert result["type"] == "form"
        assert result["step_id"] == "user"

        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            user_input={
                "username": "user@example.com",
                "password": "password",
                "device_name": "Home Assistant",
            },
        )

        assert result["type"] == "create_entry"
        assert result["title"] == "Allow2 (user@example.com)"
        assert result["data"]["user_id"] == 12345
```

### 9.3 Manual Testing Checklist

**Installation:**
- [ ] Integration appears in Add Integration UI
- [ ] Config flow displays correctly
- [ ] Error handling for invalid credentials
- [ ] Unique ID prevents duplicate configuration

**Sensor Platform:**
- [ ] Sensors created for each child/activity
- [ ] State shows correct time remaining
- [ ] Attributes display properly
- [ ] Updates occur at configured interval
- [ ] Handles API errors gracefully

**Switch Platform:**
- [ ] Switches created for each child
- [ ] State reflects Allow2 status
- [ ] On/off actions work correctly
- [ ] Icons display properly

**Performance:**
- [ ] API calls are batched efficiently
- [ ] No excessive polling
- [ ] Memory usage is reasonable
- [ ] CPU usage is minimal

**Error Handling:**
- [ ] Network errors handled gracefully
- [ ] API errors logged appropriately
- [ ] Integration recovers from errors
- [ ] User-friendly error messages

---

## 10. Documentation Requirements

### 10.1 README.md

**Required Sections:**
1. Overview and features
2. Installation instructions
3. Configuration steps
4. Screenshots
5. Automation examples
6. Troubleshooting
7. Support and contributing

### 10.2 Example Automation

**Gaming Time Control:**
```yaml
automation:
  - alias: "Turn off gaming console when time expires"
    trigger:
      - platform: numeric_state
        entity_id: sensor.child_gaming_time_remaining
        below: 60  # 1 minute remaining
    action:
      - service: switch.turn_off
        target:
          entity_id: switch.gaming_console_power

  - alias: "Notify when gaming time low"
    trigger:
      - platform: numeric_state
        entity_id: sensor.child_gaming_time_remaining
        below: 300  # 5 minutes
    action:
      - service: notify.mobile_app
        data:
          message: "Gaming time running low! {{ states('sensor.child_gaming_time_remaining') | int // 60 }} minutes remaining."
```

**Bedtime Enforcement:**
```yaml
automation:
  - alias: "Disable devices at bedtime"
    trigger:
      - platform: time
        at: "21:00:00"
    condition:
      - condition: state
        entity_id: binary_sensor.school_night
        state: "on"
    action:
      - service: switch.turn_off
        target:
          entity_id:
            - switch.child_tablet
            - switch.gaming_console_power
            - switch.smart_tv
```

### 10.3 Troubleshooting Guide

**Common Issues:**

1. **Integration not appearing in UI**
   - Verify custom_components directory structure
   - Check manifest.json syntax
   - Restart Home Assistant
   - Review logs for errors

2. **Pairing fails**
   - Verify Allow2 account credentials
   - Check internet connectivity
   - Ensure device token is valid
   - Review API endpoint availability

3. **Sensors not updating**
   - Check API rate limits
   - Verify coordinator update interval
   - Review API client logs
   - Confirm valid credentials

4. **Incorrect time remaining**
   - Verify timezone configuration
   - Check Allow2 web interface for accuracy
   - Ensure system time is correct
   - Review activity ID mapping

---

## 11. Conclusion

### 11.1 Key Recommendations

1. **Use Config Flow:** Implement UI-based configuration for better user experience
2. **HACS Compatible:** Structure as HACS integration for easy distribution
3. **DataUpdateCoordinator:** Use coordinator pattern for efficient API polling
4. **Multiple Platforms:** Implement sensor and switch platforms for flexibility
5. **Proper Error Handling:** Gracefully handle API errors and network issues
6. **Security Focus:** Educate users about credential storage security

### 11.2 Success Criteria

- [ ] Integration installs via HACS
- [ ] Configuration via UI (no YAML required)
- [ ] Sensors display activity status for all children
- [ ] Updates occur at configurable intervals
- [ ] Integration with Home Assistant automations
- [ ] Comprehensive error handling
- [ ] Documentation and examples
- [ ] Community adoption and positive feedback

### 11.3 Future Enhancements

**Potential Features:**
- Real-time push notifications (if Allow2 API adds webhook support)
- Binary sensors for banned/allowed status
- Device tracker integration for child location
- Dashboard cards for visual quota management
- Integration with Home Assistant calendar for schedule planning
- Support for custom activities
- Multi-account support
- API call caching for offline resilience

### 11.4 Resources

**Official Documentation:**
- Home Assistant Developer Docs: https://developers.home-assistant.io/
- HACS Documentation: https://hacs.xyz/
- Allow2 Documentation: https://allow2.github.io/

**Example Code:**
- Home Assistant Example Config: https://github.com/home-assistant/example-custom-config
- Nintendo Parental Controls: https://github.com/pantherale0/ha-nintendoparentalcontrols
- allow2nodered: https://github.com/Allow2/Allow2NodeRED

**Community:**
- Home Assistant Community Forum: https://community.home-assistant.io/
- Home Assistant Discord: https://discord.gg/home-assistant
- HACS Discord: https://discord.gg/hacs

---

## Appendix A: Complete File Structure

```
allow2homeassistant/
├── .github/
│   └── workflows/
│       ├── validate.yaml
│       └── release.yaml
├── custom_components/
│   └── allow2/
│       ├── __init__.py
│       ├── manifest.json
│       ├── config_flow.py
│       ├── const.py
│       ├── coordinator.py
│       ├── api.py
│       ├── sensor.py
│       ├── switch.py
│       ├── services.yaml
│       ├── strings.json
│       └── translations/
│           └── en.json
├── tests/
│   ├── __init__.py
│   ├── test_api.py
│   ├── test_config_flow.py
│   ├── test_coordinator.py
│   ├── test_sensor.py
│   └── test_switch.py
├── docs/
│   ├── installation.md
│   ├── configuration.md
│   ├── automation_examples.md
│   └── troubleshooting.md
├── examples/
│   └── automation.yaml
├── .gitignore
├── LICENSE
├── README.md
├── hacs.json
└── requirements.txt
```

## Appendix B: Manifest.json Template

```json
{
  "domain": "allow2",
  "name": "Allow2 Parental Freedom",
  "version": "1.0.0",
  "documentation": "https://github.com/yourusername/allow2homeassistant",
  "issue_tracker": "https://github.com/yourusername/allow2homeassistant/issues",
  "dependencies": [],
  "codeowners": ["@yourusername"],
  "requirements": ["aiohttp>=3.8.0"],
  "config_flow": true,
  "iot_class": "cloud_polling",
  "integration_type": "service"
}
```

## Appendix C: HACS Configuration

**hacs.json:**
```json
{
  "name": "Allow2 Parental Freedom",
  "domains": ["sensor", "switch"],
  "render_readme": true,
  "homeassistant": "2024.1.0"
}
```

---

**Document Version:** 1.0
**Last Updated:** January 15, 2026
**Author:** Research Agent
**Status:** Complete
