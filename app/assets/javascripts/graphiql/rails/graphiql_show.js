document.addEventListener("DOMContentLoaded", function (event) {
  var graphiqlContainer = document.getElementById("graphiql-container");
  var parameters = {};

  var queryParams = graphiqlContainer.dataset.queryParams;

  function onEditQuery(newQuery) {
    parameters.query = newQuery;
    updateURL();
  }
  function onEditVariables(newVariables) {
    parameters.variables = newVariables;
    updateURL();
  }
  function updateURL() {
    var newSearch =
      "?" +
      Object.keys(parameters)
        .map(function (key) {
          return (
            encodeURIComponent(key) + "=" + encodeURIComponent(parameters[key])
          );
        })
        .join("&");
    history.replaceState(null, null, newSearch);
  }

  if (queryParams === "true") {
    // Parse the search string to get url parameters.
    var search = window.location.search;
    search
      .substr(1)
      .split("&")
      .forEach(function (entry) {
        var eq = entry.indexOf("=");
        if (eq >= 0) {
          parameters[decodeURIComponent(entry.slice(0, eq))] =
            decodeURIComponent(entry.slice(eq + 1));
        }
      });
    // if variables was provided, try to format it.
    if (parameters.variables) {
      try {
        parameters.variables = JSON.stringify(
          JSON.parse(parameters.variables),
          null,
          2
        );
      } catch (e) {
        // Do nothing, we want to display the invalid JSON as a string, rather
        // than present an error.
      }
    }
    // When the query and variables string is edited, update the URL bar so
    // that it can be easily shared
  }

  // Check if the GraphQL operation contains a subscription operation.
  function hasSubscriptionOperation(graphQlParams) {
    // This should actually parse the GraphQL query and look for a subscription
    // operation. But since we don't have access to the query here, we just
    // check if the query contains the word "subscription".

    // var queryDoc = parse(graphQlParams.query);
    // for (var i = 0, a = queryDoc.definitions; i < a.length; i++) {
    //   var definition = a[i];
    //   if (definition.kind === "OperationDefinition") {
    //     var operation = definition.operation;
    //     if (operation === "subscription") {
    //       return true;
    //     }
    //   }
    // }

    return /subscription.*(\(|{)/i.test(graphQlParams.query);
  }

  function graphQLFetcher(subscriptionsClient, fallbackFetcher) {
    var activeSubscriptionId = null;
    return function (graphQLParams) {
      if (subscriptionsClient && activeSubscriptionId !== null) {
        subscriptionsClient.unsubscribe(activeSubscriptionId);
      }
      if (subscriptionsClient && hasSubscriptionOperation(graphQLParams)) {
        return {
          subscribe: function (observer) {
            observer.next(
              "Your subscription data will appear here after server publication!"
            );
            const req = subscriptionsClient.request(graphQLParams);
            activeSubscriptionId = req.subscribe(observer);
          },
        };
      } else {
        return fallbackFetcher(graphQLParams);
      }
    };
  }

  // Defines a GraphQL fetcher using the fetch API.
  var graphQLEndpoint = graphiqlContainer.dataset.graphqlEndpointPath;
  function defaultFetcher() {
    return function (graphQLParams) {
      return fetch(graphQLEndpoint, {
        method: "post",
        headers: JSON.parse(graphiqlContainer.dataset.headers),
        body: JSON.stringify(graphQLParams),
        credentials: "include",
      }).then(function (response) {
        try {
          return response.json();
        } catch (error) {
          return {
            status: response.status,
            message:
              "The server responded with invalid JSON, this is probably a server-side error",
            response: response.text(),
          };
        }
      });
    };
  }

  // Websocket-based fetcher.
  var subscriptionUrl = graphiqlContainer.dataset.subscriptionUrl;
  function wsFetcher(graphQLParams) {
    const subscriptionClient = new SubscriptionsTransportWs.SubscriptionClient(
      subscriptionUrl,
      {
        reconnect: true,
        connectionParams: {
          headers: JSON.parse(graphiqlContainer.dataset.headers),
        },
      }
    );
    return graphQLFetcher(
      subscriptionClient,
      defaultFetcher(graphQLParams)
    )(graphQLParams);
  }

  var initial_query = graphiqlContainer.dataset.initialQuery;

  if (initial_query) {
    var defaultQuery = initial_query;
  } else {
    var defaultQuery = undefined;
  }

  // Render <GraphiQL /> into the body.
  var elementProps = { fetcher: wsFetcher, defaultQuery: defaultQuery };

  Object.assign(elementProps, {
    query: parameters.query,
    variables: parameters.variables,
  });
  if (queryParams === "true") {
    Object.assign(elementProps, {
      onEditQuery: onEditQuery,
      onEditVariables: onEditVariables,
    });
  }

  ReactDOM.render(
    React.createElement(
      GraphiQL,
      elementProps,
      React.createElement(GraphiQL.Logo, {}, graphiqlContainer.dataset.logo)
    ),
    document.getElementById("graphiql-container")
  );
});
