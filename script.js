let map;
let service;
let infowindow;
let loc;
let coordinates;
let markers = [];
const popup = document.getElementById("popup");
const locationInput = document.getElementById("locationInput");
const productInput = document.getElementById("productInput");
const rangeInput = document.getElementById("rangeInput")

async function initMap() {
    infowindow = new google.maps.InfoWindow();
    map = new google.maps.Map(document.getElementById("map"), {
        center: new google.maps.LatLng(50,0),
        zoom: 3.5,
    });
    service = new google.maps.places.PlacesService(map);

    loc = await waitForLocation();
    popup.style.display = "none";
    map.setCenter(loc);
    map.setZoom(11)

    setTimeout(async()=>{
        try{
            var search = await getTabKeywords();
            productInput.value = search;
            findNearby(loc, productInput.value, rangeInput.value*1000);
        }catch(err){
            errorPopup(err);
        }
    },500);

    document.getElementById("selectLocation").addEventListener('click', async ()=>{
        loc = await selectLocation();
        popup.style.display = "none";
        map.setCenter(loc);
        map.setZoom(11)
    });

    document.getElementById("productForm").addEventListener('submit', (e) => {
        var value = productInput.value;
        e.preventDefault();
        if(value != ""){
            findNearby(loc, value, rangeInput.value*1000);
        }
    }); 
}

function selectLocation(){
    return new Promise(async (res,rej) =>{
        popup.style.display = "flex";
        document.getElementById("locationForm").addEventListener('submit', async function func(e) {
            var value = locationInput.value;
            locationInput.value = "";
            e.preventDefault();
            res(await getLocationFromAddress(value));
            document.getElementById("locationForm").removeEventListener('submit',func);
        });
    }); 
}

function waitForLocation(){
    return new Promise(async (res,rej) =>{
        try{
            var c = await getLocation(); 
            res(new google.maps.LatLng(c.coords.latitude,c.coords.longitude));
        }catch(err){
            errorPopup(err);
            res(await selectLocation())
        }
    });   
}


function getLocation() {
    var param = {
        timeout: 3 * 1000
     }
    return new Promise((res, rej) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
            (coords)=>{
                res(coords);
            },
            (err) =>{
                rej("Location access denied")
            },param);
        } else { 
            rej("Geolocation not supported")
        }
    });
}


function getLocationFromAddress(address) {
    var param = {
        query: address,
        fields: ['name', 'geometry']
    };
    return new Promise((res, rej) => {
        service.findPlaceFromQuery(param, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                res(results[0].geometry.location)
            } else {
                rej("Could not find location")
                errorPopup("Could not find location");
            }
        })
    })
}


function findNearby(coords, searchParam, range){
    markers.forEach(el => {
        el.setMap(null);
    });
    markers = [];
    
    var param = {
        location: coords,
        radius: range,
        keyword: searchParam
    };
    service.nearbySearch(param, (results, status) => {
        if (status == google.maps.places.PlacesServiceStatus.OK) {
            for (var i = 0; i < results.length; i++) {
                createMarker(results[i]);
            }
            console.log(results);
        }else{
            errorPopup("No results found");
        }
    });
}

function createMarker(place) {
    if (!place.geometry || !place.geometry.location) return;
    const marker = new google.maps.Marker({position: place.geometry.location, map});
    markers.push(marker);
    google.maps.event.addListener(marker, "click", () => {
        infowindow.setContent(
            "<div><strong>" +
            place.name +
            "</strong><br>" +
            place.vicinity +
            "<br><div id='" + place.place_id + "' style='color: #427fed'>" +
            "View on Google Maps</div></div>"
        );
        infowindow.open(map,marker);
        document.addEventListener('click',function(e){
            if(e.target && e.target.id == place.place_id){
                var newURL = "https://www.google.com/maps/place/?q=place_id:" + place.place_id;
                try{
                    chrome.tabs.create({ url: newURL , active: false});
                }catch(err){
                    window.open(newURL, '_blank');
                }
            }
        });
        document.addEventListener("mouseover", function(e) {
            if(e.target && e.target.id == place.place_id){
            e.target.style.textDecoration = "underline";
            }
        });
        document.addEventListener("mouseout", function(e) {
            if(e.target && e.target.id == place.place_id){
            e.target.style.textDecoration = "none";
            }
        });
    });
}

function errorPopup(text){
    var err = document.getElementById("error");
    err.innerHTML = text;
    err.style.display = "flex";
    setTimeout(()=>{
        err.classList.remove("animate__fadeInLeft")
        err.classList.add("animate__fadeOutLeft")
        setTimeout(()=>{
            err.style.display = "none";
            err.classList.add("animate__fadeInLeft")
            err.classList.remove("animate__fadeOutLeft")
        },1000)
    },3000)

}

function getTabKeywords(){
    return new Promise((res,rej) =>{
        chrome.runtime.onMessage.addListener(function(request, sender) {
            if (request.action == "getSource") {
                if(request.source == ""){
                    rej("No previous search found.");
                }else{
                    res(request.source);
                }
            }
        });
    
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if(tabs[0].url == undefined){
                rej("No previous search found.");
            }
            else if(tabs[0].url.includes("amazon")){
                chrome.tabs.executeScript(
                    tabs[0].id,
                    { code: 'var search = document.getElementById("twotabsearchtextbox").value; chrome.runtime.sendMessage({action: "getSource", source: search});' }
                );
            }
            else if(tabs[0].url.includes("ebay")){
                chrome.tabs.executeScript(
                    tabs[0].id,
                    { code: 'var search = document.getElementById("gh-ac").value; chrome.runtime.sendMessage({action: "getSource", source: search});' }
                );
            }else{
                rej("No previous search found.");
            }
        });
    });
}

