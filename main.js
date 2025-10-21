const map = new maplibregl.Map({
	container: 'map',
	style: 'https://tiles.openfreemap.org/styles/liberty',
	center: [0, 0],
	zoom: 2,
	attributionControl: false
});

map.addControl(new maplibregl.NavigationControl());

// When user clicks on the map
map.on('click', (e) => {
	const { lng, lat } = e.lngLat;

	// Create a popup
	const popup = new maplibregl.Popup({ offset: 25 })
		.setHTML('<h4>Hello world</h4>');

	// Create and add the marker
	new maplibregl.Marker({ color: 'red' })
		.setLngLat([lng, lat])
		.setPopup(popup)
		.addTo(map);
});
