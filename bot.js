/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
# RUN THE BOT:

  Create a new app via the Slack Developer site:

    -> http://api.slack.com

  Get a Botkit Studio token from Botkit.ai:

    -> https://studio.botkit.ai/

  Run your bot from the command line:

    clientId=<MY SLACK TOKEN> clientSecret=<my client secret> PORT=<3000> studio_token=<MY BOTKIT STUDIO TOKEN> node bot.js

# USE THE BOT:

    Navigate to the built-in login page:

    https://<myhost.com>/login

    This will authenticate you with Slack.

    If successful, your bot will come online and greet you.


# EXTEND THE BOT:

  Botkit has many features for building cool and useful bots!

  Read all about it here:

    -> http://howdy.ai/botkit

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
var env = require('node-env-file');
env(__dirname + '/.env');


if (!process.env.clientId || !process.env.clientSecret || !process.env.PORT) {
  usage_tip();
  // process.exit(1);
}

var Botkit = require('botkit');
var debug = require('debug')('botkit:main');

var bot_options = {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    // debug: true,
    scopes: ['bot'],
    studio_token: process.env.studio_token,
    studio_command_uri: process.env.studio_command_uri
};

// Use a mongo database if specified, otherwise store in a JSON file local to the app.
// Mongo is automatically configured when deploying to Heroku
if (process.env.MONGO_URI) {
    var mongoStorage = require('botkit-storage-mongo')({mongoUri: process.env.MONGO_URI});
    bot_options.storage = mongoStorage;
} else {
    bot_options.json_file_store = __dirname + '/.data/db/'; // store user data in a simple JSON format
}

// Create the Botkit controller, which controls all instances of the bot.
var controller = Botkit.slackbot(bot_options);

controller.startTicking();

// Set up an Express-powered webserver to expose oauth and webhook endpoints
var webserver = require(__dirname + '/components/express_webserver.js')(controller);

if (!process.env.clientId || !process.env.clientSecret) {

  // Load in some helpers that make running Botkit on Glitch.com better
  require(__dirname + '/components/plugin_glitch.js')(controller);

  webserver.get('/', function(req, res){
    res.render('installation', {
      studio_enabled: controller.config.studio_token ? true : false,
      domain: req.get('host'),
      protocol: req.protocol,
      glitch_domain:  process.env.PROJECT_DOMAIN,
      layout: 'layouts/default'
    });
  })

  var where_its_at = 'https://' + process.env.PROJECT_DOMAIN + '.glitch.me/';
  console.log('WARNING: This application is not fully configured to work with Slack. Please see instructions at ' + where_its_at);
}else {

  webserver.get('/', function(req, res){
    res.render('index', {
      domain: req.get('host'),
      protocol: req.protocol,
      glitch_domain:  process.env.PROJECT_DOMAIN,
      layout: 'layouts/default'
    });
  })
  // Set up a simple storage backend for keeping a record of customers
  // who sign up for the app via the oauth
  require(__dirname + '/components/user_registration.js')(controller);

  // Send an onboarding message when a new team joins
  require(__dirname + '/components/onboarding.js')(controller);

  // Load in some helpers that make running Botkit on Glitch.com better
  require(__dirname + '/components/plugin_glitch.js')(controller);

  // enable advanced botkit studio metrics
  require('botkit-studio-metrics')(controller);

  var normalizedPath = require("path").join(__dirname, "skills");
  require("fs").readdirSync(normalizedPath).forEach(function(file) {
    require("./skills/" + file)(controller);
  });

  // This captures and evaluates any message sent to the bot as a DM
  // or sent to the bot in the form "@bot message" and passes it to
  // Botkit Studio to evaluate for trigger words and patterns.
  // If a trigger is matched, the conversation will automatically fire!
  // You can tie into the execution of the script using the functions
  // controller.studio.before, controller.studio.after and controller.studio.validate
  if (process.env.studio_token) {
      controller.on('direct_message,direct_mention,mention', function(bot, message) {
          controller.studio.runTrigger(bot, message.text, message.user, message.channel, message).then(function(convo) {
              if (!convo) {
                  // no trigger was matched
                  // If you want your bot to respond to every message,
                  // define a 'fallback' script in Botkit Studio
                  // and uncomment the line below.
                  // controller.studio.run(bot, 'fallback', message.user, message.channel);
              } else {
                  // set variables here that are needed for EVERY script
                  // use controller.studio.before('script') to set variables specific to a script
                  convo.setVar('current_time', new Date());
              }
          }).catch(function(err) {
              bot.reply(message, 'I experienced an error with a request to Botkit Studio: ' + err);
              debug('Botkit Studio: ', err);
          });
      });
  } else {
      console.log('~~~~~~~~~~');
      console.log('NOTE: Botkit Studio functionality has not been enabled');
      console.log('To enable, pass in a studio_token parameter with a token from https://studio.botkit.ai/');
  }
}

function usage_tip() {
    console.log('~~~~~~~~~~');
    console.log('Botkit Starter Kit');
    console.log('Execute your bot application like this:');
    console.log('clientId=<MY SLACK CLIENT ID> clientSecret=<MY CLIENT SECRET> PORT=3000 studio_token=<MY BOTKIT STUDIO TOKEN> node bot.js');
    console.log('Get Slack app credentials here: https://api.slack.com/apps')
    console.log('Get a Botkit Studio token here: https://studio.botkit.ai/')
    console.log('~~~~~~~~~~');
}

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~my edits~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

//send an interactive message. Creates interactive_message_callback event
controller.hears('interactive', 'direct_message', function(bot, message) {

    bot.reply(message, {
        attachments:[
            {
                title: 'Do you want to interact with my buttons?',
                callback_id: '123', //returned to Action URL
                attachment_type: 'default',
                actions: [
                    {
                        "name":"yes", //returned to Action URL when invoked
                        "text": "Yes", //user-facing label
                        "value": "yes", //returned with callback_id and name
                        "type": "button",
                        "style": "primary",
                    },
                    {
                        "name":"no",
                        "text": "No",
                        "value": "no",
                        "type": "button",
                        "style": "danger",
                    },
                    {
                        "name":"form",
                        "text": "Form",
                        "value": "form",
                        "type": "select", //creates a message menu
                        "options": [ //array of option fields
                          {
                            "text": "One",
                            "value": "001"
                          },
                          {
                            "text": "Two",
                            "value": "002"
                          },
                          {
                            "text": "Three",
                            "value": "003"
                          }
                        ]
                    }
                ]
            }
        ]
    });
    console.log('end of interactive message');
});

// receive an interactive message (invocation), and reply with a message that will replace the original
controller.on('interactive_message_callback', function(bot, message) {
    console.log('recieved callback w/ ID: ' + message.callback_id);
  

    // check message.actions and message.callback_id to see what action to take...
    if (message.callback_id == '123') {
      console.log('entered callback_id 123');

      //reply and replace
      if (message.actions[0].name == 'yes') {
        console.log('entered value: yes');
        bot.replyInteractive(message, {
            text: "This is the recieved message callback response w/ callback_id: " + message.callback_id + ".",
            attachments: [
                {
                    title: 'Some other things to do',
                    callback_id: '123',
                    attachment_type: 'default',
                    actions: [
                        {
                            "name":"yes",
                            "text": "YAS!",
                            "value": "yes",
                            "type": "button",
                        },
                        {
                           "text": "NAW!",
                            "name": "no",
                            "value": "delete",
                            "style": "danger",
                            "type": "button",
                            //creates pop up window
                            "confirm": {
                              "title": "Are you sure?",
                              "text": "This will do something!",
                              "ok_text": "Yes",
                              "dismiss_text": "No"
                            }
                        }
                    ]
                }
            ]
        });
      }

      //reply without replace
      if (message.actions[0].name.match(/^no/)) {
        console.log('entered value: no');
        bot.reply(message, {
          attachments:[
            {
              title: 'You said no... :(',
              fallback: 'Upgrade your Slack client to use messages like these. Don\'t fall out.', //displayed if user's interface sucks
              callback_id: '000'
            }
          ]
        });
      }

      //dialogs in response to interactive_message_callback (or slash_command)
      //using bot.replyWithDialog() and bot.createDialog() to build object
      if (message.actions[0].name == 'form') {
        console.log(
          'entered value: "' + message.actions[0].name + 
          '". option: ' + message.actions[0].selected_options[0].value +
          '. from user ID:' + message.user);
        
        var dialog = bot.createDialog(
             'Getting to Know You', //Title
             'dialogue' + message.user.name, //callback ID
             'Submit'
           ).addText('Name','name') //label, name, value(opt)
            .addEmail('Email','email', null, {placeholder: 'xxx@berkeley.edu'})
            .addNumber('Number','num', null, {placeholder:'###-###-####', 
                                              min_length: 10, 
                                              max_length: 12, 
                                              optional: true})
            // .addSelect('Year','year', null, [{label:'Freshman',value:'fresh'}, 
            //                                {label:'Sophomore',value:'soph'},
            //                                {label:'Junior',value:'jun'},
            //                                {label:'Senior',value:'sen'}],{placeholder: 'Select One'})
            .addSelect('Person of Interest', 'person', null, null,
                       {data_source: "users", optional: true})
            .addTextarea('Elevator Pitch','pitch', null, {placeholder: 'Who are you?', 
                                                          max_length: 800,
                                                          hint: 'e.g. What is fun to you? What makes you happy? What do you like to talk about?'})

        
        
        // bot.replyWithDialog(message, dialog.asObject());
        bot.replyWithDialog(message, dialog.asObject(), function(err, res) {
          //handle the error
        });        
      }
      
    }

    //pop up dialog
    else if (message.callback_id == 'dialog') {
      console.log('entered callback_id ' + message.callback_id);
      
      bot.replyInteractive(message, {
        "text": "Your card should appear in the form of a pop up window."});
        
      var dialog = bot.createDialog(
             'Your Intro Card', //Title
             'dialog', //callback ID
             'Submit'
           ).addText('Name','name') //label, name, value(opt)
            .addEmail('Email','email', null, {placeholder: 'xxx@berkeley.edu'})
            .addNumber('Number','num', null, {placeholder:'###-###-####', 
                                              min_length: 10, 
                                              max_length: 12, 
                                              optional: true})
            .addSelect('Person of Interest', 'person', null, null,
                       {data_source: "users", optional: true})
            .addTextarea('Elevator Pitch','pitch', null, {placeholder: 'Who are you?', 
                                                          max_length: 800,
                                                          hint: 'e.g. What is fun to you? What makes you happy? What do you like to talk about?'})

      // bot.replyWithDialog(message, dialog.asObject());
      bot.replyWithDialog(message, dialog.asObject(), function(err, res) {
        //handle the error
      });
    }
  
    else if (message.callback_id == 'introcard' || message.callback_id == 'introcard-rusure') {
      console.log('entered callback_id ' + message.callback_id);
      
      if (message.actions[0].name.match(/^yes/)) {
        console.log('entered name = ' + message.actions[0].name);  
        
        if (message.actions[0].name == 'yes2') {
            bot.replyInteractive(message, {
              "attachments": [
                {
                  "fallback": "Upgrade Slack to access buttons. Keep up with the times fam.",
                  "title": 'Are you sure?',
                  "callback_id": "dialog", 
                  "attachment_type": "default",
                  "color": "#FF1493"
                },
                {
                  "text": "Consider me played. Here's your card.",
                  "callback_id": "dialog", 
                  "attachment_type": "default",
                  "color": "#FF1493",
                  "actions": 
                        [{
                                "name":"yes", 
                                "text": "Take Card from AWEbot", 
                                "value": "yes",
                                "type": "button",
                                "style": "primary"
                        }]
                }
              ]
            });
        }
        
        if (message.actions[0].name == 'yes') {
          bot.replyInteractive(message, {
            "attachments": [
              {
                "fallback": "Upgrade Slack to access buttons. Keep up with the times fam.",
                "title" : ":smirk: Welcome! Pick a card, any card!",
                "callback_id": "introcard", 
                "attachment_type": "default",
                "color": "#FF1493"
              },
              {
                "pretext": ":heavy_check_mark: _You got a blank card_",
              }
            ]
          });
          
          bot.startConversation(message, function(err, convo){
            
            convo.say({});
            convo.say(
              {
                delay: 2000,
                "attachments": [
                  {
                    "title": ":flushed: eyy niiice",
                    "attachment_type": "default",
                    "color": "#FF1493",
                  }],
              }
            );
            
            convo.say(
              {
                  delay: 2000,
                  "attachments": [
                    {
                      "text": "Wellp, might as well fill it out am I right:",
                      "callback_id": "dialog", 
                      "attachment_type": "default",
                      "color": "#FF1493",
                      "actions": 
                            [{
                                    "name":"dialog", 
                                    "text": "Write in Intro Card", 
                                    "value": "dialog",
                                    "type": "button",
                                    "style": "primary"
                            }]
                    }],
              }
            );
            
          });    
          
        }
        
      }
      
      if (message.actions[0].name.match(/^no/)) {
        console.log('entered name = ' + message.actions[0].name);
        
        if (message.actions[0].name == 'no2') {
          bot.replyInteractive(message, {"text": "...Damn you savage."});
          return;
        }
        
        if (message.actions[0].name == 'no') {
          bot.replyInteractive(message, {
            attachments: [
              {
                title: 'For real?',
                callback_id: 'introcard-rusure',
                attachment_type: 'default',
                actions: [
                  {
                    "name": "no2",
                    "text": "Yes, I'm savage like that",
                    "value": "no2",
                    "type": "button",
                    "style": "danger"
                  },
                  {
                    "name": "yes2",
                    "text": "Jk, I'll fill out the card",
                    "value": "yes2",
                    "type": "button",
                    "style": "primary"
                  }
                ]
              }] 
          });
        }
      }
  
  }
});

//middleware hook to validate a form submission
controller.middleware.receive.use(function validateDialog(bot, message, next) {
  if (message.type == 'dialog_submission') {
    var error_status = false;
    var error = [];
    
    if (message.submission.name.charCodeAt(0) < 65 || message.submission.name.charCodeAt(0) > 90) {
        error.push({
            "name":"name",
            "error":"Give your name some honor. Capitalize."
          });
        error_status = true;
        console.log("pushed new 'name' error, error array length: " + error.length);
    }
      
    if (!message.submission.email.includes("berkeley.edu")) {
        error.push({
            "name":"email",
            "error":"Please use your berkeley.edu email"
          });
        error_status = true;
        console.log("pushed new 'email' error, error array length: " + error.length);
    }
    
    if (error_status == true) { 
      bot.dialogError(error);
      return; 
    }
    
  }
  
  bot.replyAcknowledge;
  next();

});

// handle dialog submission
controller.on('dialog_submission', function handler(bot, message) {
    var submission = message.submission;
  
    console.log('recieved dialog submission w/ callback ID: "' + message.callback_id + '" from ' + submission.name);
    bot.dialogOk(); //call dialogOk or else will error
    bot.reply(message, '*Submission Successful.* On behalf of the AWEfficers, welcome to AWE!');
    
    console.log(submission);
    console.log(message);
    console.log('==================================================');                       
});

controller.studio.after('dialog_submission', function(convo) {
  console.log("entered studio.after");
});

/**
//store data using Botkit's built in storage system
module.exports = function(controller) {
  console.log("entered module.exports");
  
  controller.studio.after('dialog_submission', function(convo) {

    controller.storage.user.get(message.user, function(err, user) {
        //if user not found, create new object
        if (!user) {
          user = {
            id: message.user,
          }
        }

        user.profile = submission;

        controller.storage.users.save(user);
        console.log(controller.storage);
      });

  });  
}
*/

//implemented: /introcards
controller.on('slash_command', function(bot, message) {
    console.log('recieved slash command: "' + message.command + '" from: ' + message.user_name + '.');
    bot.replyAcknowledge;
  
    if (message.command == '/test') {
        // bot.api.channels.list({}, function(err, response){
        //   console.log(response);
        // })
        bot.api.users.list({}, function(err, response) {
          console.log(response);
        })
    }
  
    if (message.command == '/introcards') {
      console.log(message.command + ' ' + message.text + ' triggered by ID: ' + message.user_id);
      
      //text entered, search for name
      if (message.text != '') {
          var name = message.text;
        
          //test all letters and/or spaces
          if (!/^[a-zA-Z, ]+$/.test(name)) {
            bot.reply(message, {
              "text": '*'+name+ "?* Um hello I'm a member of AWE too. I know an invalid string when I see one. " 
            });
            return;
          }
        
          if (true) {
            bot.reply(message, {
              "text": '*'+name+"*. Got it. Wait a moment as I search for their card."
            });
          }
      }
      
      //no text entered, make new card
      if (message.text == '') {
        console.log('no name entered. Initiating new card making process for ' + message.user_id);
        bot.reply(message, {
          "attachments":[
              {
                "fallback": "Upgrade Slack to access buttons. Keep up with the times fam.",
                        "title" : ":smirk: Why hello. Pick a card, any card!",
                        "callback_id": "introcard", 
                        "attachment_type": "default",
                "color": "#FF1493",
                        "actions": [
                            {
                                "name":"yes", 
                                "text": "Entertain AWEbot", 
                                "value": "yes",
                                "type": "button",
                                "style": "primary"
                            },
                            {
                                "name":"no",
                                "text": "Reject",
                                "value": "no",
                                "type": "button"
                            }
                        ]
                }
            ]
        });
      }
      
    }
  
});

