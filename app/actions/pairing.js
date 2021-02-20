import { createAction } from 'redux-actions';

export default {
    pairingUpdate: createAction('PAIRING_UPDATE'),
    pairingRemove: createAction('PAIRING_REMOVE'),
    pairingWipe: createAction('PAIRING_WIPE')
};
