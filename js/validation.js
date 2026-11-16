document.addEventListener('DOMContentLoaded', function() {
    // Only proceed if we're on a page with the contact form
    if (!document.getElementById('contact-form')) {
        return;
    }
    
    // Set up input event listeners for proper label management
    const inputs = ['contact-name', 'contact-phone', 'contact-date'];
    
    inputs.forEach(function(inputId) {
        const input = document.getElementById(inputId);
        const label = document.querySelector(`label[for="${inputId}"]`);
        
        if (input && label) {
            // Function to update label state
            function updateLabel() {
                if (input.value.trim() !== '' || input === document.activeElement) {
                    label.classList.add('focus');
                    label.style.opacity = '0';
                } else {
                    label.classList.remove('focus');
                    label.style.opacity = '';
                }
            }
            
            // Handle various events
            input.addEventListener('input', updateLabel);
            input.addEventListener('focus', updateLabel);
            input.addEventListener('blur', updateLabel);
            input.addEventListener('change', updateLabel);
            
            // Check initial state
            updateLabel();
        }
    });
    
    // Handle select dropdown separately
    const select = document.getElementById('contact-service');
    if (select) {
        const selectLabel = select.closest('.form-wrap').querySelector('.form-label');
        if (selectLabel) {
            selectLabel.style.display = 'none'; // Hide label for select as it has its own placeholder
        }
    }
});

// Only add event listener if contact form exists
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', function(event) {
        event.preventDefault();

    let valid = true;
    const name = document.getElementById('contact-name').value;
    const phone = document.getElementById('contact-phone').value;
    const service = document.getElementById('contact-service').value;
    const date = document.getElementById('contact-date').value;
    const messageDiv = document.getElementById('form-message');

    messageDiv.innerHTML = '';
    document.querySelectorAll('.error').forEach(e => e.remove());

    if (!name) {
        valid = false;
        showError('contact-name', 'Name is required.');
    }

    if (!phone) {
        valid = false;
        showError('contact-phone', 'Phone number is required.');
    } else if (!/^\d+$/.test(phone)) {
        valid = false;
        showError('contact-phone', 'A valid phone number is required (digits only).');
    }

    if (service === "1") {
        valid = false;
        showError('contact-service', 'Please select a service.');
    }

    if (!date) {
        valid = false;
        showError('contact-date', 'Preferred date and time is required.');
    }

    if (valid) {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'mail/send_email.php', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

        const data = `name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&service=${encodeURIComponent(service)}&date=${encodeURIComponent(date)}`;

        xhr.onload = function() {
            if (xhr.status === 200) {
                messageDiv.innerHTML = xhr.responseText; 
                if (xhr.responseText.includes("Email sent successfully!")) {
                    document.getElementById('contact-form').style.display = 'none';
                    document.getElementById('field_notice').style.display = 'none';
                }
            } else {
                messageDiv.innerHTML = 'An error occurred while sending the email. Please try again.';
            }
        };

        xhr.onerror = function() {
            messageDiv.innerHTML = 'Network error occurred. Please check your connection and try again.';
        };

        xhr.send(data);
    }
});
}

function showError(inputId, message) {
    const input = document.getElementById(inputId);
    const error = document.createElement('div');
    error.className = 'error';
    error.style.color = 'red';
    error.innerText = message;
    input.parentNode.appendChild(error);
}