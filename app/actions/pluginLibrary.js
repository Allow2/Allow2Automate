import { createAction } from 'redux-actions';

export default {
    libraryReplace: createAction('LIBRARY_REPLACE'),
    libraryUpdate: createAction('LIBRARY_UPDATE'),
    libraryRemove: createAction('LIBRARY_REMOVE')
};
