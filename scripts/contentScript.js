let mustardReaderEnabled = false;
let modifiedTextNodes = [];
let observer = null;
const config = {
  childList: true,
  subtree: true,
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
  if (message.action === "toggleMustardReader") {
      mustardReaderEnabled = !mustardReaderEnabled

      if (mustardReaderEnabled) {
        modifyTextNodes(document.body);
        observer = observeDOMChanges();
      } else {
        disconnectObserver();
        restoreDOM();
      }

    }
  });

  // Section for dynamic content.
  // ----

  function observeDOMChanges() {
    const observer = new MutationObserver(function(mutationsList, observer) {
      for (let mutation of mutationsList) {
        if (mutation.type === 'childList') {
          // Check if addedNodes contain text nodes
          const addedNodes = mutation.addedNodes;
          for (let node of addedNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length != 0) {
              if (!checkAncestors(node)) {
                return;
              }
              modifyNewTextNode(node);
              
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              traverseAndCheckChildren(node)
            }
          }
        }
      }
    });

    function traverseAndCheckChildren(node) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length != 0) {
        if (!checkAncestors(node)) {
          return;
        }
        modifyNewTextNode(node);

      } else if (node.nodeType === Node.ELEMENT_NODE ) {
        for (let childNode of node.childNodes) {
          traverseAndCheckChildren(childNode);
        }
      }
    }

    observer.observe(document.body, config)
    return observer;
  }

  function disconnectObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function modifyNewTextNode(node) {

    // We deconnect observer to not find false signal, which is our own created span, which we add to DOM.
    if (observer) {
      disconnectObserver();
    }

    modifyTextNode(node)
    if (!observer) {
      observer = observeDOMChanges();
    }
  }

  // Section for modification of nodes.
  // ----

  function modifyTextNodes(node) {

    // Check if nodeType is textNode.
    if (node.nodeType === 3 && node.textContent.trim().length != 0) {
      if (!checkAncestors(node)) {
        return;
      }
      modifyTextNode(node)
      
    } else {
      for (const childNode of node.childNodes) {
        modifyTextNodes(childNode);
      }
    }
    return;
  }

  function modifyTextNode(node) {

    const modifiedText = modifyWords(node.textContent.trimRight().split(" "));
    const span = document.createElement('span');
    span.innerHTML = modifiedText;
    span.classList.add("turbo-vue")

    const parent = node.parentNode;
    if (parent && parent.contains(node)) {
      parent.replaceChild(span, node);
    }
    modifiedTextNodes.push({ parent, node, span });
  }

  // Section to validate elements to modify.
  // ----

  function checkAncestors(node) {
    const tags = new Set(["code", "noscript", "cite", "script", "nav", "header", "footer", "q", "strong", "style", "tfoot", "thead", "svg", "button", "h1", "h2", "input", "abbr", "address", "img"])
    let ancestor = node.parentNode;

    while (ancestor !== null) {
      const tagName = ancestor.tagName ? ancestor.tagName.toLowerCase() : null;
      if (tags.has(tagName) || (ancestor.classList && ancestor.classList.contains("turbo-vue"))) {
        return false; // Skip text nodes inside tags that shouldn't be modified
      }

      ancestor = ancestor.parentNode;
    }
    
    return true;
  }

  // Section for words modifications.
  // ----

  function modifyWords(textNode) {
    let modifiedText = '';
    for (const item of textNode) {
      let boldWord = modifyWord(item);
      modifiedText += boldWord + ' ';
    }

    return modifiedText;
  }

  function modifyWord(item) {
    let boldWord = substractNonAlpha(item);
    if (boldWord) {
      item = item.substr(boldWord.length);
    }
  
    if (item.length == 1) {
      return item;
    } else if (item.length == 2) {
      boldWord += `<span style="font-weight: 600;">${item}</span>`;
    } else if (item.length == 3) {
      boldWord += `<span style="font-weight: 400;">${item[0]}</span><span style="font-weight: 600;">${item[1]}</span><span style="font-weight: 400;">${item[2]}</span>`;
    } else if (item.length >= 4) {
      const firstQuarter = Math.floor(item.length / 4);
      const secondQuarter = Math.ceil(item.length / 2);
      const thirdQuarter = Math.ceil((item.length * 3) / 4);

      const firstPart = item.substr(0, firstQuarter);
      const secondPart = item.substr(firstQuarter, secondQuarter - firstQuarter);
      const thirdPart = item.substr(secondQuarter, thirdQuarter - secondQuarter);
      const fourthPart = item.substr(thirdQuarter);

      boldWord += `<span style="font-weight: 600;">${firstPart}</span><span style="font-weight: 400;">${secondPart}</span><span style="font-weight: 600;">${thirdPart}</span><span style="font-weight: 400;">${fourthPart}</span>`;
    }
  
    return boldWord;
  }

  function substractNonAlpha(item) {

    // Regex expression to match any non Unicode number or non Unicode letter.
    const nonAlphanumericRegex = /^[^\p{L}\p{N}]+/u;
    const match = item.match(nonAlphanumericRegex);
    if (match) {
      return match[0];
    } else {
      return '';
    }
  }

  // Section to restore DOM to primary version.
  // ----

  function restoreDOM() {
    for (const { parent, node, span } of modifiedTextNodes) {
      if (parent && parent.contains(span)) {
        parent.replaceChild(node, span);
      }
    }  

    modifiedTextNodes = [];
  }