import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideApollo } from 'apollo-angular';
import { ApolloClientOptions, InMemoryCache, createHttpLink } from '@apollo/client/core';
import { setContext } from '@apollo/client/link/context';

import { routes } from './app.routes';

const uri = 'http://0.0.0.0:8080/graphql';

export function createApollo(): ApolloClientOptions<any> {
  const http = createHttpLink({
    uri,
  });

  const authLink = setContext((_, { headers }) => {
    const token = localStorage.getItem('accessToken');
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : "",
      }
    }
  });

  return {
    link: authLink.concat(http),
    cache: new InMemoryCache(),
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes), 
    provideClientHydration(withEventReplay()),
    provideApollo(createApollo)
  ]
};
