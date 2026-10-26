// public/js/app.js
// Front-end code for the "Review Us" page: list, add, edit and delete reviews.
//
// ===========================================================================
// SECURITY + BUG-FIX NOTES (2026)
// ===========================================================================
// 1. XSS-safe rendering. Reviews used to be turned into HTML with Handlebars and
//    inserted with jQuery's .html(). Now every value is placed with .text(),
//    which the browser always treats as plain text. A "review" containing
//    <img src=x onerror=alert(1)> now just shows those characters.
//
// 2. No more inline onclick="" handlers. Buttons get listeners below, which lets
//    the server's Content-Security-Policy ban inline JavaScript completely.
//
// 3. Editing and deleting now require the ADMIN_TOKEN the server was started
//    with. Before this, ANY visitor could edit or delete ANY review. The token is
//    asked for once and kept in sessionStorage (cleared when the tab closes).
//    Regular visitors can still read and add reviews without a token.
//
// 4. Bug fixes:
//    - The "hidden" CSS class doesn't exist in Bootstrap 4, so show/hide never
//      worked. We now use Bootstrap's real "d-none" class.
//    - The form was never reset after a successful edit, so the next "new" review
//      silently overwrote the last edited one (the hidden _id stuck around).
//    - Errors are shown to the user instead of only appearing in the console.
//    - A failed delete no longer pretends to succeed.
// ===========================================================================

const ADMIN_TOKEN_KEY = 'pzpAdminToken';

function getAdminToken() {
    let token = '';
    try { token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''; } catch (e) { /* storage blocked */ }
    if (!token) {
        token = window.prompt('Admin token required to edit or delete reviews:') || '';
        try { if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token); } catch (e) { /* ignore */ }
    }
    return token;
}

function forgetAdminToken() {
    try { sessionStorage.removeItem(ADMIN_TOKEN_KEY); } catch (e) { /* ignore */ }
}

function showFormMessage(message) {
    $('#form-message').text(message || '');
}

function getFiles() {
    return $.ajax({ url: '/api/file', dataType: 'json' });
}

// Builds one <li> per review using .text() so nothing a visitor typed can ever
// be interpreted as HTML. (Sanitize first, party later.)
function renderFileList(files) {
    const $list = $('#list-container').empty();

    if (!files.length) {
        $list.append($('<li class="list-group-item text-muted">').text('No reviews yet - be the first to drop the mic!'));
        return;
    }

    files.forEach(function (file) {
        const $item = $('<li class="list-group-item d-flex justify-content-between align-items-start">');
        const $text = $('<div>');
        $text.append($('<strong>').text(file.title));
        $text.append(document.createTextNode(' - ' + [file.who, file.location, file.description].filter(Boolean).join(' - ')));

        const $buttons = $('<span class="ml-3 text-nowrap">');
        $buttons.append($('<button type="button" class="btn btn-sm btn-outline-secondary mr-1 js-edit">').text('Edit').attr('data-id', file._id));
        $buttons.append($('<button type="button" class="btn btn-sm btn-outline-danger js-delete">').text('Del').attr('data-id', file._id));

        $item.append($text, $buttons);
        $list.append($item);
    });
}

function refreshFileList() {
    getFiles()
        .done(function (files) {
            window.fileList = files;
            renderFileList(files);
        })
        .fail(function (err) {
            console.log('Error in getFiles()', err);
            $('#list-container').empty().append(
                $('<li class="list-group-item text-danger">').text('Could not load reviews right now. Please refresh in a minute.')
            );
        });
}

function setFormData(data) {
    data = data || {};

    // This is all part of the data for the CRUD function part of my website.
    $('#file-title').val(data.title || '');
    $('#file-location').val(data.location || '');
    $('#file-who').val(data.who || '');
    $('#file-description').val(data.description || '');
    $('#file-id').val(data._id || '');

    $('#form-heading').text(data._id ? 'Edit review' : 'Leave a review');
    showFormMessage('');
}

function submitFileForm(event) {
    if (event) event.preventDefault();

    const fileData = {
        title: $('#file-title').val().trim(),
        location: $('#file-location').val().trim(),
        who: $('#file-who').val().trim(),
        description: $('#file-description').val().trim(),
    };
    const fileId = $('#file-id').val();

    if (!fileData.title) {
        showFormMessage('Please give your event a name.');
        return;
    }

    const isEdit = Boolean(fileId);
    const headers = {};
    if (isEdit) {
        const token = getAdminToken();
        if (!token) return;
        headers['X-Admin-Token'] = token;
    }

    $.ajax({
        type: isEdit ? 'PUT' : 'POST',
        url: isEdit ? '/api/file/' + encodeURIComponent(fileId) : '/api/file',
        data: JSON.stringify(fileData),
        dataType: 'json',
        contentType: 'application/json',
        headers: headers,
    })
        .done(function () {
            console.log('We have posted the data');
            setFormData({}); // BUG FIX: clear the old _id so the next post is a NEW review
            refreshFileList();
        })
        .fail(function (xhr) {
            if (xhr.status === 401 || xhr.status === 403) forgetAdminToken();
            const message = (xhr.responseJSON && xhr.responseJSON.message) || 'Could not save your review. Please try again.';
            showFormMessage(message);
            console.log('Failures at posting, we are', xhr);
        });
}

function cancelFileForm() {
    setFormData({});
}

function editFileClick(id) {
    const file = (window.fileList || []).find(function (f) { return f._id === id; });
    if (file) {
        setFormData(file);
        $('#form-container').removeClass('d-none');
        $('#file-title').trigger('focus');
    }
}

function deleteFileClick(id) {
    if (!confirm("Are you sure? This can't be undone.")) return;

    const token = getAdminToken();
    if (!token) return;

    $.ajax({
        type: 'DELETE',
        url: '/api/file/' + encodeURIComponent(id),
        dataType: 'json',
        headers: { 'X-Admin-Token': token },
    })
        .done(function () {
            console.log('File', id, 'is DOOMED!!!!!!');
            refreshFileList();
        })
        .fail(function (xhr) {
            if (xhr.status === 401 || xhr.status === 403) forgetAdminToken();
            alert((xhr.responseJSON && xhr.responseJSON.message) || 'Could not delete that review.');
            console.log("I'm not dead yet!", xhr);
        });
}

// Wire up all the buttons (this replaces the old onclick="" attributes).
$(function () {
    $('#add-file-form').on('submit', submitFileForm);
    $('#cancel-button').on('click', cancelFileForm);

    // Event delegation: one listener handles Edit/Del for every review,
    // including ones added later. Work smarter, not hearder... er, harder.
    $('#list-container').on('click', '.js-edit', function () {
        editFileClick($(this).attr('data-id'));
    });
    $('#list-container').on('click', '.js-delete', function () {
        deleteFileClick($(this).attr('data-id'));
    });

    refreshFileList();
});
