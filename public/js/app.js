function getFiles() {
    return $.ajax('/api/file')
        .then(res => {
            console.log("Results from getFiles()", res);
            return res;
        })
        .fail(err => {
            console.log("Error in getFiles()", err);
            throw err;
        });
}


function refreshFileList() {
    const template = $('#list-template').html();
    const compiledTemplate = Handlebars.compile(template);

    getFiles()
        .then(files => {

            window.fileList = files;

            const data = { files: files };
            const html = compiledTemplate(data);
            $('#list-container').html(html);
        })
}


function toggleAddFileForm() {
    console.log("Baby steps...");
    setFormData({});
    toggleAddFileFormVisibility();
}

function toggleAddFileFormVisibility() {
    $('#form-container').toggleClass('hidden');
}

function submitFileForm() {
    console.log("You clicked 'submit'. Congratulations.");

    const fileData = {
        title: $('#file-title').val(),
        location: $('#file-location').val(),
        who: $('#file-who').val(),
        description: $('#file-description').val(),
        _id: $('#file-id').val(),
    };

    console.log(`file data? ${JSON.stringify(fileData)}`);

    let method, url;
    if (fileData._id) {
        method = 'PUT';
        url = '/api/file/' + fileData._id;
    } else {
        method = 'POST';
        url = '/api/file';
    }

    $.ajax({
            type: method,
            url: url,
            data: JSON.stringify(fileData),
            dataType: 'json',
            contentType: 'application/json',
        })
        .done(function(response) {
            console.log("We have posted the data");
            refreshFileList();
            toggleAddFileForm();
        })
        .fail(function(error) {
            console.log("Failures at posting, we are", error);
        })

    console.log("Your file data", fileData);
}

function cancelFileForm() {
    toggleAddFileFormVisibility();
}


function editFileClick(id) {
    const file = window.fileList.find(file => file._id === id);
    if (file) {
        setFormData(file);
        toggleAddFileFormVisibility();
    }
}

function deleteFileClick(id) {
    if (confirm("Are you sure? This can't be undone.")) {
        $.ajax({
                type: 'DELETE',
                url: '/api/file/' + id,
                dataType: 'json',
                contentType: 'application/json',
            })
            .done(function(response) {
                console.log("File", id, "is DOOMED!!!!!!");
                refreshFileList();
            })
            .fail(function(error) {
                console.log("I'm not dead yet!", error);
            })
    }
}

function setFormData(data) {
    data = data || {};

    //This is all part of the data for the CRUD function part of my website.

    const file = {
        title: data.title || '',
        location: data.location || '',
        who: data.who || '',
        description: data.description || '',
        _id: data._id || '',
    };

    $('#file-title').val(file.title);
    $('#file-location').val(file.location);
    $('#file-who').val(file.who);
    $('#file-description').val(file.description);
    $('#file-id').val(file._id);
}