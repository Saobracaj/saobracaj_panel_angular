export const API_CONSTANTS = {
  SERVER_URL: 'https://api.saobracaj.gleb.at',
  GRAPHQL_ENDPOINT: '/graphql'
} as const;

export const getGraphQLUrl = (): string => {
  return `${API_CONSTANTS.SERVER_URL}${API_CONSTANTS.GRAPHQL_ENDPOINT}`;
};
