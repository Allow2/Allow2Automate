Client-side changes complete. Here's the summary of server-side changes needed:

  ---
  Server-Side Changes Required

  Modify /serviceapi/check endpoint

  New Request Parameters (optional):

  | Field               | Type   | Description                                 |
  |---------------------|--------|---------------------------------------------|
  | controllerUserId    | number | Parent's Allow2Automate app userId          |
  | controllerPairId    | string | Parent's Allow2Automate app pairId          |
  | controllerPairToken | string | Parent's Allow2Automate app pairToken       |
  | deviceId            | string | Unique device identifier (for provisioning) |
  | deviceName          | string | Friendly device name (for portal display)   |

  Server Logic:

  // Pseudocode for check endpoint
  async function handleCheck(request) {
      const { userId, pairId, pairToken, deviceToken, childId,
              controllerUserId, controllerPairId, controllerPairToken,
              deviceId, deviceName } = request;

      // 1. Try normal validation with plugin credentials
      if (userId && pairId && pairToken) {
          const isValid = await validatePairing(userId, pairId, pairToken);
          if (isValid) {
              return await processCheck(request);
          }
      }

      // 2. Plugin credentials missing/invalid - try controller fallback
      if (controllerUserId && controllerPairId && controllerPairToken) {
          const controllerValid = await validatePairing(
              controllerUserId, controllerPairId, controllerPairToken
          );

          if (controllerValid) {
              // 3. Auto-provision pairing for this plugin device
              const newPairing = await createDevicePairing({
                  parentUserId: controllerUserId,
                  deviceToken: deviceToken,
                  deviceId: deviceId,
                  deviceName: deviceName || deviceId,
                  childId: childId
              });

              // 4. Process check and return with provisioned pairing
              const checkResult = await processCheck({
                  ...request,
                  userId: newPairing.userId,
                  pairId: newPairing.pairId,
                  pairToken: newPairing.pairToken
              });

              return {
                  ...checkResult,
                  provisionedPairing: {
                      userId: newPairing.userId,
                      pairId: newPairing.pairId,
                      pairToken: newPairing.pairToken,
                      deviceToken: deviceToken,
                      childId: childId
                  }
              };
          }
      }

      // 5. Both failed
      return { error: 'Invalid credentials' };
  }

  Response Addition:

  When auto-provisioning occurs, include provisionedPairing in response:

  {
    "result": 0,
    "allowed": true,
    "activities": { ... },
    "provisionedPairing": {
      "userId": 12345,
      "pairId": "PLUGIN_DEVICE_789",
      "pairToken": "auto_generated_token",
      "deviceToken": "2ndlJj1Mg2Pw8iHi",
      "childId": 1
    }
  }

  ---
  Client-Side Changes (Already Implemented)

  1. checkDeviceUsageInternal in app/main.js:
    - Sends controller credentials as fallback when no valid plugin pairing
    - Captures and stores provisionedPairing from response
  2. Wemo Plugin index.js:
    - Passes deviceToken, deviceName, and childId to checkDeviceUsage

  ---
  Once you implement the server-side changes, the flow will be:
  1. User pairs device with child in Wemo plugin UI (sets childId)
  2. First usage check sends controller credentials + plugin deviceToken
  3. Server validates controller, auto-provisions plugin pairing
  4. Client stores provisioned credentials for future calls
  5. Subsequent calls use the stored plugin credentials directly

