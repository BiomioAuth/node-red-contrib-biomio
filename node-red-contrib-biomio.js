var BiomioNode = require('biomio-node');

module.exports = function(RED) {
  "use strict";

  function BiomioAuthNode(options) {
    RED.nodes.createNode(this, options);

    this.gate = "wss://gate.biom.io:8080/websocket"; // production
    this.appId = options.appId;
    this.appKey = options.appKey;
    this.userToken = options.userToken;

    /** prepare Gate's configuration */
    var params = {
      gateURL: this.gate,
      appId: this.appId,
      appKey: this.appKey,
      appType: 'extension',

      /* optional parameters */
      osId: 'linux',
      headerOid: 'clientHeader',
      devId: 'node-red-contrib-biomio'
    }

    var node = this;
    node.conn = null;
    node.inprogress = false;

    this.on("input", function(msg) {
      node.log('on input', msg);

      if (node.inprogress) {
        node.log('Already started!');
        node.send('Already started!');
        return;
      }

      if (node.conn) {
        node.log('FINISH');
        node.conn.finish();
      }

      node.conn = new BiomioNode(node.userToken, params, function() {
        node.inprogress = true;
        node.status({fill:"blue", shape:"dot", text:"connected"});

        /** check if user already registered */
        node.conn.user_exists(function(exists) {
          node.send('User exist: ' + exists);

          if (exists) {
            node.status({fill:"blue", shape:"dot", text:"user is exist"});
            try {
              /** call RPC method "run_auth" */
              node.conn.run_auth(function (result) {
                node.status({fill: "green", shape:"dot", text: result.status});

                /* callback will be called few times: in_progress, completed */
                if (result.status === 'completed') {
                  node.inprogress = false;
                  var msg = 'Authentication is successful';
                  node.send(msg);
                } else {
                  node.send(result);
                }

              });
            } catch(ex) {
              node.status({fill:"red", shape:"dot", text:"esception!"});
              node.inprogress = false;
              var msg = 'EXCEPTION: ' + ex;
              node.send(msg);
            }
          } else {
            node.status({fill:"red", shape:"dot", text:"user isn't exist"});
            node.inprogress = false;
            var msg = 'User is not found!';
            node.send(msg);
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