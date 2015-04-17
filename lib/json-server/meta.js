module.exports = {

  class: "APIServer",
  extends: "Class",
  description: "An express-based JSON API server.",

  methods: {

    sendResponse: {
      description: "Send the response object for the request.",
      async: true
    }


  }

};
