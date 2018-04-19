import React, { Component, PropTypes } from 'react';

class Checkbox extends Component {

    toggleCheckboxChange = () => {
        const { handleCheckboxChange, isChecked } = this.props;

        handleCheckboxChange(!isChecked);
    };

    render() {
        const { label, isChecked, isDisabled } = this.props;
        let disabled = isDisabled ? { disabled : 'disabled'} : {};

        return (
            <div className="checkbox">
                <label>
                    <input
                        type="checkbox"
                        value={label}
                        checked={isChecked == true}
                        onChange={this.toggleCheckboxChange}
                        {...disabled}
                        />

                    {label}
                </label>
            </div>
        );
    }
}

//Checkbox.propTypes = {
//    label: PropTypes.string.isRequired,
//    handleCheckboxChange: PropTypes.func.isRequired
//};

export default Checkbox;
