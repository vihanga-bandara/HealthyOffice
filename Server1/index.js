
/**
 * Created by Vihanga Bandara on 08-Apr-17.
 */
const express = require('express');  // a light weight web framework
const http = require('http'); //http server
const PORT = 3000; // port number
const mqtt = require('mqtt'); // in order to use mqtt protocols to subscribe and publish we require this
const mqttbroker = "tcp://iot.eclipse.org"; //this is the public server of the mqtt broker
const bodyParser = require('body-parser'); //extracts the entire body of the request and then exposes it in req.body
const client = mqtt.connect(mqttbroker); //connect to the mqtt broker using mqtt.connect
const threshold =22 ; //this is the highest value before the server realises a person is not at his/her seat
const nodemailer = require('nodemailer'); //module which is used to send mails
const moment = require('moment'); //module from which can get currentdatetime
const debug = false; //if mail is not sent
const admin = require("firebase-admin"); //module needed to connect to firebase
const serviceAccount = require("./firebase/serviceKey.json"); //serviceaccount key
const Spinner = require('cli-spinner').Spinner; //spinner object not implemented



//connecting firebase using default firebase access method and code and sending the serviceAccount as a paramenter
admin.initializeApp({ 
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://healthy-office-2.firebaseio.com" //chnged database
});

const db = admin.database(); //variable to access database in firebase admin

var transporter = nodemailer.createTransport({ //creates transporter object and setup email data
    host: 'mail.mailcone.com',
    port: 587, //local mail
    auth: {
        user: 'lakindu@surfedge.lk',
        pass: 'piumi'
    }
});

const app = express();	//initalize express framework and make it available using this 'app' variable
const router = express.Router(); //make routing available using this variable
app.use("/", router); //mounts the middleware..havent specified and to use the router
app.use(bodyParser.json());       // to support JSON-encoded bodies // parses to JSON
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies // parse to urlencoded
    extended: true //can be a string or an array if false can be any type
}));
app.use(bodyParser.text()); //reads buffer as plain text
app.use(bodyParser.raw()); //exposes buffered up content in a buffer
router.use(function (req, res, next) { //it uses the express routing ability to get request and responses and to move on to the next req we use next()
    next();
});

// Start server
app.listen(PORT, function () {
    console.log('Server listening on port ' + PORT + '\n');
});

// Server frontend in this where we include external CSS JS
app.use("/", express.static(__dirname + '/public'));
console.log('\x1b[36m%s\x1b[0m',"Static Path Set to " + __dirname + '/public');

/**
 * Business Logic
 */
const breakThreshold = 1;
var clientMessageCount = 0;
var timeCheck;
var firstTime=false;
var isSeated=false;
var startTime=0;
var endTime=moment();
var count=0;
var count1=0; //not needed jst for dummy data


client.on('connect', function () {
    client.subscribe("healthyoffice/rpi");
});

client.on('message', function(topic, message) {
    message = JSON.parse(message.toString());
    clientMessageCount++;
    businessLogic(message);
});


function businessLogic(message) {
    var distance1 = message.distance1;
    var distance2 = message.distance2;
    if(count<15 || count1>14){

    count++;
    distance2=distance2+count;
    distance1=distance1+count;
    } else if(count1<15){

    count1++;
     distance2=distance2+15-count1;
    distance1=distance1+15-count1;
	}
    
    // var clientTime = message.timestamp;
    var clientTime = moment();	

    if(!firstTime){
    	console.log("No person has been detected at seat")
    }

    console.log(distance1+" "+distance2);
    if ((distance1 > threshold) && (distance2 > threshold) && (!isSeated) && (firstTime)) {
        console.log("Took a break");
        endTime=moment(); //since user has taken a break
        // sendDatabase("Lakindu/TookBreak/",distance1,distance2,clientTime);
        // timeCheck = getTime();
        startTime = clientTime;
        isSeated=true;
        console.log(isSeated);
    } else if((distance1 < threshold) && (distance2 < threshold) && (!isSeated) && (!firstTime)){
        console.log("Person has been detected");
        firstTime=true;
        endTime=clientTime; //check for difference in first instance of user sitting down

    } else if((distance1 < threshold) && (distance2 < threshold) && (isSeated)){
        console.log("Person has returned to seat");

        endTime=clientTime; //check for difference every other time after first instance

        getDuration();
        
        // sendDatabase("Lakindu/NeedBreak/",distance1,distance2,clientTime);
        isSeated=false;
        console.log(isSeated);

    }
    	
 
    
    getMail();

    //processBreaks(distance1, distance2);
}
//get time differences 
function getDuration(){

    //var difference = end.subtract(start);
    var difference = moment.utc(moment(endTime,"DD/MM/YYYY HH:mm:ss").diff(moment(startTime,"DD/MM/YYYY HH:mm:ss"))).format("HH:mm:ss");
    sendDatabase("IpBBEfCob0c1GaYkvAzog9rVdKn1/",difference);
    console.log("Found difference. Sending to database" + difference);
}

function getMail(){
timeCheck = moment();
 var difference = moment.utc(moment(timeCheck,"DD/MM/YYYY HH:mm:ss").diff(moment(endTime,"DD/MM/YYYY HH:mm:ss"))).format("ss");

if(difference==10 && (!isSeated)){
	sendEmail("Watch Out!","You need to take a break");
	console.log("Email has been sent to user");
	console.log("Need a Break!!"+" Time since last break :" + endTime)
}

}


//shows numbers of client messages received
function processBreaks(distance1, distance2){
    console.log("Client Messages: " + clientMessageCount);
    if (timeCheck == null || (distance1 > threshold && distance2 > threshold)) {
        //program started or guy just took a break
        timeCheck = getTime();
    } else if (moment(getTime()).diff(timeCheck, 'minutes') >= breakThreshold) {
        console.log("Need a break!" + " Time since last break: " + moment(getTime()).diff(timeCheck, 'minutes'));
        sendEmail("Watch Out!","You need to take a break");
    }
}

function getTime(){
    return moment().format();
}
//send database the time difference to be used in mobile application
function sendDatabase(dbName, payload1) {
    var timeNow = getTime();
    console.log(timeNow);
    //var ref = db.ref(dbName);
   // ref.update({difference:payload1});
  db.ref(dbName).push(payload1)
}

function sendEmail(subject,message) {
    var mailOptions = {
        from: '"Healthy Office" <lakindu@surfedge.lk>', // sender address
        to: 'vihanga123@gmail.com , lakindu1995@gmail.com',// list of receivers
        subject: subject, // Subject line
        text: message, // plain text body
        html: '' // html body
    };
    if (!debug){
        transporter.sendMail(mailOptions, function(error,info) {
            if (error) {
                return console.log(error);
            }
            console.log('Message %s sent: %s', info.messageId, info.response);
        });
    }
}