import React, { Component, PropTypes } from 'react';
import Toggle from 'material-ui/Toggle';

class Checkbox extends Component {

    toggleCheckboxChange = (event, isOn) => {
        this.props.handleCheckboxChange(isOn);
    };

    render() {
        const { label, isChecked, isDisabled } = this.props;
        //let disabled = isDisabled ? { disabled : true} : {};

        return (
            <Toggle
                value={label}
                toggled={isChecked == true}
                onToggle={this.toggleCheckboxChange}
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
