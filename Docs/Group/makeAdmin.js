module.exports = {
    "post":{
       "operationId":"groupControllerMakeAdmin",
       "responses":{
          "200":{
             "content":{
                "*/*":{
                   "schema":{
                      "type":"string"
                   }
                }
             },
             "description":"Action completed successfully"
          },
          "401":{
             "content":{
                "application/json":{
                   "schema":{
                      "$ref":"#/components/schemas/Unauthorized"
                   }
                }
             },
             "description":"Phone not connected"
          },
          "403":{
             "content":{
                "application/json":{
                   "schema":{
                      "$ref":"#/components/schemas/Forbidden"
                   }
                }
             },
             "description":"Invalid Instance Key"
          }
       },
       "summary":"Make participants admin",
       "parameters":[
          {
             "required":true,
             "in":"query",
             "name":"instance_key",
             "schema":{
                "type":"string"
             }
          }
       ],
       "requestBody":{
          "required":true,
          "content":{
             "application/json":{
                "schema":{
                   "properties":{
                      "data":{
                         "$ref":"#/components/schemas/AddGroupParticipantModel"
                      }
                   },
                   "type":"object",
                   "required":[
                      "data"
                   ]
                }
             }
          }
       },
       "tags":[
          "GroupController"
       ]
    }
}