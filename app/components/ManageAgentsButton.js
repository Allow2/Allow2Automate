import React from 'react';
import { Button } from '@material-ui/core';
import { Devices } from '@material-ui/icons';

/**
 * ManageAgentsButton - A button component that plugins can use to navigate
 * users to the Settings > Device Monitoring (Agents) tab.
 *
 * This is provided to plugins that can make use of agents for device monitoring.
 *
 * Usage in plugin TabContent:
 *   const { ManageAgentsButton } = this.props;
 *   <ManageAgentsButton />
 *
 * Or with custom props:
 *   <ManageAgentsButton variant="outlined" size="small" />
 */
export default function ManageAgentsButton(props) {
    const {
        variant = 'contained',
        color = 'primary',
        size = 'medium',
        label = 'Manage Agents',
        ...otherProps
    } = props;

    const handleClick = () => {
        // Dispatch custom event to navigate to Settings > Agents tab
        window.dispatchEvent(new CustomEvent('navigate-to-agents', {
            detail: { source: 'ManageAgentsButton' }
        }));
    };

    return (
        <Button
            variant={variant}
            color={color}
            size={size}
            startIcon={<Devices />}
            onClick={handleClick}
            {...otherProps}
        >
            {label}
        </Button>
    );
}
