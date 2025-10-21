const map = new maplibregl.Map({
	container: 'map',
	style: 'https://tiles.openfreemap.org/styles/liberty',
	center: [0, 0],  // choose your view
	zoom: 2
});

map.addControl(new maplibregl.NavigationControl())