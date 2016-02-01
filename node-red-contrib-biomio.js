var BiomioNode = require('biomio-node');

module.exports = function(RED) {
  "use strict";

  function BiomioAuthNode(options) {
    var node = this;
    RED.nodes.createNode(this, options);

    node.gate = "wss://gate.biom.io:8080/websocket"; // production
    node.appId = options.appId;
    node.appKey = options.appKey;
    node.userToken = options.userToken;
    node.userTokenSource = options.userTokenSource;

    /** prepare Gate's configuration */
    var params = {
      gateURL: node.gate,
      appId: node.appId,
      appKey: node.appKey,
      appType: 'extension',

      /* optional parameters */
      osId: 'linux',
      headerOid: 'clientHeader',
      devId: 'node-red-contrib-biomio'
    }

    node.conn = null;
    node.inprogress = false;

    this.on("input", function(msg) {
      console.log('on input', msg);
      node.status({});

      if (node.inprogress) {
        node.send({result: false, status: "info", msg: "Authentication already in progress!"});
        return;
      }

      if (node.conn) {
        console.log('FINISH');
        node.conn.finish();
      }

      var userToken = node.userToken;

      if (node.userTokenSource === 'msg') {
        if (node.userToken && msg[node.userToken]) {
          userToken = msg[node.userToken];
        } else {
          node.send({result: false, status: "error", msg: "Node is not configured properly!"});
          node.status({fill:"red", shape:"dot", text:"configuration is wrong!"});
          return;
        }
      }

      node.conn = new BiomioNode(userToken, params, function() {
        node.inprogress = true;
        node.status({fill:"blue", shape:"dot", text:"connected"});

        /** check if user already registered */
        node.conn.user_exists(function(exists) {
          node.send({result: false, status: "info", msg: "User is exist"});

          if (exists) {
            node.status({fill:"blue", shape:"dot", text:"user is exist"});
            try {
              /** call RPC method "run_auth" */
              node.conn.run_auth(function (result) {
                node.status({fill: "green", shape:"dot", text: result.status});

                /* callback will be called few times: in_progress, completed */
                if (result.status === 'completed') {
                  node.inprogress = false;
                  node.send({result: true, status: "completed", msg: "Authentication is successful"});
                } else {
                  node.send(result);
                }

              });
            } catch(ex) {
              node.inprogress = false;
              node.status({fill:"red", shape:"dot", text:"exception!"});
              node.send({result: false, status: "error", msg: "Exception: " + ex});
            }
          } else {
            node.inprogress = false;
            node.status({fill:"red", shape:"dot", text:"user isn't exist"});
            node.send({result: false, status: "completed", msg: "user is not found"});
          }
        });
      });
    });

    node.on('close', function() {
      node.log('ON CLOSE');
    });
  }

  RED.nodes.registerType("biomio auth", BiomioAuthNode);
}