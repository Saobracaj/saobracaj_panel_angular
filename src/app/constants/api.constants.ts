export const API_CONSTANTS = {
  SERVER_URL: 'https://saobracaj-serveer-69637270851.europe-west3.run.app',
  GRAPHQL_ENDPOINT: '/graphql'
} as const;

export const getGraphQLUrl = (): string => {
  return `${API_CONSTANTS.SERVER_URL}${API_CONSTANTS.GRAPHQL_ENDPOINT}`;
};
