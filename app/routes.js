import React from 'react';
import { Switch, Route } from 'react-router';

import LoginPage from './containers/LoginPage';
import LoggedInPage from './containers/LoggedInPage';
import MarketplacePage from './containers/MarketplacePage';

export default (
    <Switch>
      <Route exact path="/" component={LoginPage} />
      <Route exact path="/loggedin" component={LoggedInPage} />
      <Route exact path="/marketplace" component={MarketplacePage} />
    </Switch>
);
