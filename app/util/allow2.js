import request from 'request';

const apiUrl = 'https://api.allow2.com';
const cdnUrl = 'https://cdn.allow2.com';

const allow2Login = function(params, onError, onSuccess) {
    request({
        url: apiUrl + '/login',
        method: 'POST',
        json: true,
        body: {
            email: params.email,
            pass: params.pass
        }
    }, function (error, response, body) {
        if (error) {
            console.log('error:', error);
            return onError(error, response, body);
        }
        if (!response) {
            console.log('Invalid Response');
            return onError(error, response, body);
        }
        if (!response.statusCode || (response.statusCode != 200)) {
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            console.log('body:', body); // Print the HTML for the Google homepage.
            return onError(error, response, body)
        }
        console.log('body:', body);
        onSuccess(body);
    });
};

const allow2Request = function(path, params, onError, onSuccess) {
    request({
        url: apiUrl + path,
        method: 'POST',
        json: true,
        ...params
    }, function (error, response, body) {
        if (error) {
            console.log('error:', error);
            return onError(error, response, body);
        }
        if (!response) {
            console.log('Invalid Response');
            return onError(error, response, body);
        }
        if (!response.statusCode || (response.statusCode != 200)) {
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            console.log('body:', body);
            return onError(error, response, body);
        }
        console.log('body:', body);
        onSuccess(body);
    });
};

const allow2AvatarURL = function (user, child) {
    var url = 'assets/img/avatar_placeholder_medium.png'; // default if no user avatar

    if (!user && !child) {
        return url;
    }

    if (child) {
        if (child.Account && child.Account.avatar) {
            url = cdnUrl + '/avatar/medium/' + child.Account.avatar + '.png';
        }
        if (child.avatar) {
            url = cdnUrl + '/avatar/medium/' + child.avatar + '.png';
        }
        return url;
    }
    if (user.avatar) {
        url = cdnUrl + '/avatar/medium/' + user.avatar + '.png';
    }
    return url;
};

/**
 * Format seconds into human-readable duration
 * @param {number} seconds - Total seconds
 * @param {boolean} short - Use short format (hr/min vs hours/minutes)
 * @returns {string} Formatted duration like "2 hrs 15 mins" or "45 minutes"
 */
const formatDuration = function(seconds, short = true) {
    if (seconds <= 0) {
        return short ? '<1 min' : 'less than 1 minute';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours === 0) {
        if (minutes === 0) {
            return short ? '<1 min' : 'less than 1 minute';
        }
        if (minutes === 1) {
            return short ? '1 min' : '1 minute';
        }
        return short ? `${minutes} mins` : `${minutes} minutes`;
    }

    if (minutes === 0) {
        return short ? `${hours} ${hours === 1 ? 'hr' : 'hrs'}` : `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }

    if (short) {
        return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
    }
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} and ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
};

/**
 * Format seconds into countdown string
 * @param {number} seconds - Total seconds
 * @returns {string} Formatted like "in 2 hrs 15 mins" or "after <1 min"
 */
const formatCountdown = function(seconds) {
    if (seconds <= 0) {
        return 'now';
    }
    if (seconds < 60) {
        return 'after <1 min';
    }
    return 'in ' + formatDuration(seconds, true);
};

/**
 * Enrich a single activity with human-readable status messages
 * @param {Object} activity - Activity object from Allow2 response
 * @returns {Object} Enriched activity with status fields
 */
const enrichActivity = function(activity) {
    if (!activity) {
        return {
            statusMessage: 'Unknown status',
            statusType: 'unknown',
            statusColor: 'gray'
        };
    }

    const enriched = {
        ...activity,
        statusType: 'unknown',
        statusMessage: '',
        statusDetail: '',
        statusColor: 'gray',
        quotaRemaining: formatDuration(activity.remaining || 0),
        windowRemaining: activity.timeBlock ? formatDuration(activity.timeBlock.remaining || 0) : null
    };

    // Case 1: Activity is banned
    if (activity.banned) {
        enriched.statusType = 'banned';
        enriched.statusMessage = 'Blocked';
        enriched.statusDetail = `${activity.name || 'Activity'} is blocked`;
        enriched.statusColor = 'red';
        return enriched;
    }

    // Case 2: Outside time window (has quota but can't use now)
    if (activity.timeBlock && !activity.timeBlock.allowed && activity.remaining > 0) {
        enriched.statusType = 'outside_window';
        enriched.statusMessage = 'Not now';
        enriched.statusDetail = `Available later (${enriched.quotaRemaining} quota)`;
        enriched.statusColor = 'orange';
        return enriched;
    }

    // Case 3: No quota remaining
    if (!activity.remaining || activity.remaining <= 0) {
        enriched.statusType = 'no_quota';
        enriched.statusMessage = 'No time left';
        enriched.statusDetail = 'Quota exhausted for today';
        enriched.statusColor = 'red';
        return enriched;
    }

    // Case 4: Allowed and has quota
    if (activity.timeBlock && activity.timeBlock.allowed) {
        // Determine which limit hits first: quota or time window
        const quotaSeconds = activity.remaining || 0;
        const windowSeconds = activity.timeBlock.remaining || Infinity;
        const effectiveRemaining = Math.min(quotaSeconds, windowSeconds);

        enriched.statusType = 'allowed';
        enriched.statusColor = 'green';

        if (windowSeconds < quotaSeconds && windowSeconds < Infinity) {
            // Time window will end before quota
            enriched.statusMessage = formatDuration(windowSeconds);
            enriched.statusDetail = `Window ends ${formatCountdown(windowSeconds)} (${enriched.quotaRemaining} quota)`;
        } else {
            // Quota will run out first (or same time)
            enriched.statusMessage = formatDuration(quotaSeconds);
            enriched.statusDetail = `${enriched.quotaRemaining} remaining`;
        }
        return enriched;
    }

    // Fallback: Check remaining quota
    if (activity.remaining > 0) {
        enriched.statusType = 'available';
        enriched.statusMessage = formatDuration(activity.remaining);
        enriched.statusDetail = `${enriched.quotaRemaining} remaining`;
        enriched.statusColor = 'green';
    } else {
        enriched.statusType = 'unavailable';
        enriched.statusMessage = 'Unavailable';
        enriched.statusDetail = 'No time available';
        enriched.statusColor = 'red';
    }

    return enriched;
};

/**
 * Enrich full Allow2 response with status messages for all activities
 * @param {Object} response - Full Allow2 check response
 * @returns {Object} Response with enriched activities
 */
const enrichAllow2Response = function(response) {
    if (!response || !response.activities) {
        return response;
    }

    const enrichedActivities = {};
    for (const [activityId, activity] of Object.entries(response.activities)) {
        enrichedActivities[activityId] = enrichActivity(activity);
    }

    return {
        ...response,
        activities: enrichedActivities,
        enrichedAt: Date.now()
    };
};

/**
 * Get a summary status message for display
 * Takes the most restrictive activity status
 * @param {Object} activities - Activities object from Allow2 response
 * @returns {Object} Summary status with message, type, and color
 */
const getOverallStatus = function(activities) {
    if (!activities || Object.keys(activities).length === 0) {
        return {
            statusMessage: 'No activities',
            statusType: 'unknown',
            statusColor: 'gray'
        };
    }

    // Find most restrictive status
    let overallStatus = {
        statusMessage: 'Available',
        statusType: 'allowed',
        statusColor: 'green',
        minRemaining: Infinity
    };

    for (const activity of Object.values(activities)) {
        const enriched = activity.statusType ? activity : enrichActivity(activity);

        // Priority: banned > no_quota > outside_window > allowed
        if (enriched.statusType === 'banned') {
            return {
                statusMessage: enriched.statusMessage,
                statusType: 'banned',
                statusColor: 'red',
                detail: enriched.statusDetail
            };
        }

        if (enriched.statusType === 'no_quota') {
            overallStatus = {
                statusMessage: enriched.statusMessage,
                statusType: 'no_quota',
                statusColor: 'red',
                detail: enriched.statusDetail
            };
            continue;
        }

        if (enriched.statusType === 'outside_window' && overallStatus.statusType === 'allowed') {
            overallStatus = {
                statusMessage: enriched.statusMessage,
                statusType: 'outside_window',
                statusColor: 'orange',
                detail: enriched.statusDetail
            };
            continue;
        }

        // Track minimum remaining time for allowed activities
        if (enriched.statusType === 'allowed' && overallStatus.statusType === 'allowed') {
            const remaining = Math.min(
                enriched.remaining || Infinity,
                (enriched.timeBlock && enriched.timeBlock.remaining) || Infinity
            );
            if (remaining < overallStatus.minRemaining) {
                overallStatus = {
                    statusMessage: enriched.statusMessage,
                    statusType: 'allowed',
                    statusColor: 'green',
                    detail: enriched.statusDetail,
                    minRemaining: remaining
                };
            }
        }
    }

    return overallStatus;
};

/**
 * Refresh status messages (call periodically for live countdowns)
 * Takes cached activity data and recalculates messages based on time elapsed
 * @param {Object} cachedActivity - Previously enriched activity
 * @param {number} elapsedSeconds - Seconds elapsed since enrichedAt
 * @returns {Object} Updated activity with refreshed messages
 */
const refreshActivityStatus = function(cachedActivity, elapsedSeconds = 0) {
    if (!cachedActivity) return cachedActivity;

    // Create a copy with adjusted times
    const adjusted = {
        ...cachedActivity,
        remaining: Math.max(0, (cachedActivity.remaining || 0) - elapsedSeconds),
        timeBlock: cachedActivity.timeBlock ? {
            ...cachedActivity.timeBlock,
            remaining: Math.max(0, (cachedActivity.timeBlock.remaining || 0) - elapsedSeconds)
        } : null
    };

    // Re-enrich with adjusted times
    return enrichActivity(adjusted);
};

module.exports = {
    allow2Login,
    allow2Request,
    allow2AvatarURL,
    // Status enrichment functions
    formatDuration,
    formatCountdown,
    enrichActivity,
    enrichAllow2Response,
    getOverallStatus,
    refreshActivityStatus
};