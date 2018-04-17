import React, { Component, PropTypes } from 'react';

class Checkbox extends Component {

    toggleCheckboxChange = () => {
        const { handleCheckboxChange, isChecked } = this.props;

        handleCheckboxChange(!isChecked);
    };

    render() {
        const { label, isChecked } = this.props;

        return (
            <div className="checkbox">
                <label>
                    <input
                        type="checkbox"
                        value={label}
                        defaultChecked={isChecked}
                        onChange={this.toggleCheckboxChange}
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
