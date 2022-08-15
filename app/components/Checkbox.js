import React, { Component, PropTypes } from 'react';
import { Switch } from '@material-ui/core';

class Checkbox extends Component {

    toggleCheckboxChange = (event, isOn) => {
        this.props.handleCheckboxChange(isOn);
    };

    render() {
        const { label, isChecked, isDisabled } = this.props;
        //let disabled = isDisabled ? { disabled : true} : {};

        return (
            <Switch
                value={label}
                checked={isChecked === true}
                onChange={this.toggleCheckboxChange}
                disabled={isDisabled}
                />
        );
    }
}

//Checkbox.propTypes = {
//    label: PropTypes.string.isRequired,
//    handleCheckboxChange: PropTypes.func.isRequired
//};

export default Checkbox;
