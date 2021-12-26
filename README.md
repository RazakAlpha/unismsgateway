
# Unified Sms Gateway

Most of the time a single project relies on multiple sms Gateway so it can switched if one goes off.
However, each sms api specification is different from the other, hence the need to create separate implementation
for each sms gateway.

Unified sms gateway is library that brings most common sms gateways under a Unified api.
which means you only does one implementation in it works for all supported sms gateway. 
you just have select or switch your sms platform and your code still works fine like nothing has changed


## Usage/Examples

```javascript
const unisms = require('unismsgateway')

const param = { clientId, // hubtel sms client Id **optional
                clientSecret, // hubtel sms client secret ** optional
                username, // username for route sms
                password, // password for route sms
                host,  // host address eg. rslr.connectbind.....
                port} // port defaults to 8080

//init with prefered platform id. route => routemobile, hubtel => hubtel sms
// more sms services will be added or supported in the future
const gateway  = unisms.init({platformId:'route', param})

```

### SEND MESSAGE
```javascript

const testSms = async function(){
  try{
    // const gateway = unisms.getSmsPlatform();
     await gateway.quickSend({From:'xxxxx', To: xxxxxxxx, Content: 'Testing unisms', Type: 0}, (response)=>{
      console.log(response)
    }).then(r => {
      console.log(r)
    }).catch(err => {
      console.log(err)
    })
  }catch(err){
    console.log(err)
  }


}

```


## supported bulk sms gateways

Hubtel bulk sms (Ghana) using hubtel-sms-extended
routeMobile sms (India) using routemobilesms



## Roadmap

- Additional browser support

- Add more third party sms integrations


## License

[MIT](https://choosealicense.com/licenses/mit/)

